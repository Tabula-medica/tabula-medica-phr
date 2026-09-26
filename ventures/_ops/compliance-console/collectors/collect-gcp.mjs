#!/usr/bin/env node
/**
 * collect-gcp.mjs — Google Cloud Platform signal collector.
 * Uses `gcloud` CLI to check IAM, buckets, Cloud SQL, backups, logging, WAF, MFA.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

const ventures = JSON.parse(readFileSync(join(ROOT, 'data', 'ventures.json'), 'utf8'));
const existing = (() => {
  try { return JSON.parse(readFileSync(join(ROOT, 'evidence', 'signals.json'), 'utf8')); }
  catch { return { collectedAt: null, bundles: { repo: {}, github: {}, deps: {}, gcp: {} } }; }
})();

function gcloud(args, proj) {
  const cmd = `gcloud ${args} --project=${proj} --format=json`;
  try {
    const raw = execSync(cmd, { timeout: 30000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(raw);
  } catch { return null; }
}

// gcloud projects get-iam-policy takes the project as a positional arg, not --project
function gcloudIamPolicy(proj) {
  const cmd = `gcloud projects get-iam-policy ${proj} --format=json`;
  try {
    const raw = execSync(cmd, { timeout: 30000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(raw);
  } catch { return null; }
}

function checkIamBindings(proj) {
  const policy = gcloudIamPolicy(proj);
  if (!policy) return {
    iamNoPublicBindings: { verdict: 'unknown', detail: 'IAM policy unavailable' },
    iamNoSharedOwner: { verdict: 'unknown', detail: 'IAM policy unavailable' },
  };

  const bindings = policy.bindings ?? [];
  const publicRoles = bindings.filter(b =>
    b.members?.some(m => m === 'allUsers' || m === 'allAuthenticatedUsers')
  );

  const ownerBinding = bindings.find(b => b.role === 'roles/owner');
  const humanOwners = (ownerBinding?.members ?? []).filter(m =>
    m.startsWith('user:') && !m.includes('serviceaccount')
  );

  // AC-01: flag personal/external email owners (gmail.com, yahoo.com, etc.) not under org SSO/2SV.
  // Multiple @tabulamedica.com / @sawd.ai co-founders = legitimate, not a shared-admin violation.
  const ORG_DOMAINS = ['tabulamedica.com', 'sawd.ai'];
  const personalOwners = humanOwners.filter(m => {
    const email = m.replace(/^user:/, '');
    return !ORG_DOMAINS.some(d => email.endsWith('@' + d));
  });

  return {
    iamNoPublicBindings: publicRoles.length === 0
      ? { verdict: 'pass', detail: 'no allUsers/allAuthenticatedUsers bindings' }
      : { verdict: 'fail', detail: `public IAM bindings on roles: ${publicRoles.map(b => b.role).join(', ')}` },
    iamNoSharedOwner: personalOwners.length === 0
      ? { verdict: 'pass', detail: `${humanOwners.length} human owner(s), all on org-managed domains` }
      : { verdict: 'fail', detail: `personal/external email in owner role (bypasses org SSO/2SV): ${personalOwners.join(', ')}` },
  };
}

function checkBuckets(proj) {
  const buckets = gcloud('storage buckets list', proj);
  if (!buckets) return { verdict: 'unknown', detail: 'storage API unavailable' };

  const publicBuckets = [];
  const websiteBuckets = [];
  for (const b of buckets) {
    const name = b.name ?? b.id ?? '';
    const isWebsite = b.website != null || name.includes('public') || name.includes('static') || name.includes('site');
    const iam = b.iamConfiguration?.publicAccessPrevention;
    if (b.acl?.some(a => a.entity === 'allUsers' || a.entity === 'allAuthenticatedUsers')) {
      if (isWebsite) websiteBuckets.push(name);
      else publicBuckets.push(name);
    }
  }

  if (publicBuckets.length > 0) {
    return { verdict: 'fail', detail: `public data bucket(s): ${publicBuckets.join(', ')}` };
  }
  return { verdict: 'pass', detail: `no public data buckets; ${websiteBuckets.length} intentional public website bucket(s)` };
}

function checkCloudSQL(proj) {
  const instances = gcloud('sql instances list', proj);
  if (!instances || instances.length === 0) {
    return {
      sqlSslRequired: { verdict: 'pass', detail: 'no Cloud SQL instances' },
      backupsEnabled: { verdict: 'pass', detail: 'no Cloud SQL instances' },
      encryptionAtRest: { verdict: 'pass', detail: 'GCP storage/SQL encrypted at rest by default (Google-managed keys)' },
    };
  }

  // requireSsl is deprecated; sslMode='ENCRYPTED_ONLY' or 'TRUSTED_CLIENT_CERTIFICATE_REQUIRED' means SSL enforced
  const SSL_MODES_SECURE = new Set(['ENCRYPTED_ONLY', 'TRUSTED_CLIENT_CERTIFICATE_REQUIRED']);
  const sslFailing = instances.filter(i => {
    const cfg = i.settings?.ipConfiguration ?? {};
    return !cfg.requireSsl && !SSL_MODES_SECURE.has(cfg.sslMode);
  });
  const backupFailing = instances.filter(i => !i.settings?.backupConfiguration?.enabled);

  return {
    sqlSslRequired: sslFailing.length === 0
      ? { verdict: 'pass', detail: `all ${instances.length} SQL instance(s) require SSL` }
      : { verdict: 'fail', detail: `${sslFailing.length} SQL instance(s) do not require SSL: ${sslFailing.map(i => i.name).join(', ')}` },
    backupsEnabled: backupFailing.length === 0
      ? { verdict: 'pass', detail: `all ${instances.length} SQL instance(s) have automated backups` }
      : { verdict: 'fail', detail: `${backupFailing.length} SQL instance(s) without backups: ${backupFailing.map(i => i.name).join(', ')}` },
    encryptionAtRest: { verdict: 'pass', detail: 'GCP storage/SQL encrypted at rest by default (Google-managed keys)' },
  };
}

function checkLogging(proj) {
  const sinks = gcloud('logging sinks list', proj);
  if (!sinks) return { verdict: 'unknown', detail: 'logging API unavailable' };
  const active = sinks.filter(s => !s.disabled);
  if (active.length > 0) return { verdict: 'pass', detail: 'Cloud Logging active (sinks/_Default present)' };
  return { verdict: 'fail', detail: 'no active Cloud Logging sinks found' };
}

function checkWaf(proj) {
  const policies = gcloud('compute security-policies list', proj);
  if (!policies) return { verdict: 'unknown', detail: 'Cloud Armor API unavailable' };
  if (policies.length > 0) return { verdict: 'pass', detail: `${policies.length} Cloud Armor policy(ies)` };
  return { verdict: 'fail', detail: 'no Cloud Armor / WAF policy' };
}

function checkMfa(proj) {
  // GCIP MFA state via Identity Toolkit REST API (gcloud identity platform doesn't exist as CLI)
  let token;
  try {
    token = execSync('gcloud auth print-access-token', { timeout: 10000, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
  } catch { return { verdict: 'unknown', detail: 'GCIP config unavailable (no gcloud token)' }; }

  try {
    const raw = execSync(
      `curl -s -H "Authorization: Bearer ${token}" -H "x-goog-user-project: ${proj}" "https://identitytoolkit.googleapis.com/v2/projects/${proj}/config"`,
      { timeout: 15000, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }
    );
    const config = JSON.parse(raw);
    const mfaState = config.mfa?.state ?? config.mfaConfig?.state;
    if (mfaState === 'ENABLED' || mfaState === 'MANDATORY') return { verdict: 'pass', detail: 'GCIP MFA enabled' };
    if (mfaState === 'DISABLED') return { verdict: 'fail', detail: 'GCIP MFA DISABLED — enable multi-factor for the tenant' };
    if (config.error) {
      // CONFIGURATION_NOT_FOUND = Identity Platform not provisioned on this project (static/infra-only projects)
      if (config.error.message?.includes('CONFIGURATION_NOT_FOUND') || config.error.status === 'NOT_FOUND') {
        return { verdict: 'na', detail: 'Identity Platform not provisioned — no app-level user auth on this project' };
      }
      return { verdict: 'unknown', detail: `GCIP API: ${config.error.message?.slice(0, 80)}` };
    }
    return { verdict: 'unknown', detail: `GCIP MFA state indeterminate: ${mfaState}` };
  } catch { return { verdict: 'unknown', detail: 'GCIP config unavailable' }; }
}

function checkFirewall(proj) {
  const rules = gcloud('compute firewall-rules list', proj);
  if (!rules) return { verdict: 'unknown', detail: 'Firewall API unavailable' };
  const openAdmin = rules.filter(r => {
    const isAllow = r.direction === 'INGRESS' && !r.disabled;
    const openSrc = r.sourceRanges?.includes('0.0.0.0/0');
    const adminPort = (r.allowed ?? []).some(a =>
      a.ports?.some(p => ['22', '3389', 'all'].includes(p)) ||
      (a.IPProtocol === 'icmp')
    );
    return isAllow && openSrc && adminPort;
  });
  if (openAdmin.length > 0) {
    return { verdict: 'fail', detail: `admin port(s) open to 0.0.0.0/0: ${openAdmin.map(r => r.name).join(', ')} — restrict SSH/RDP/ICMP` };
  }
  return { verdict: 'pass', detail: 'no admin ports open to 0.0.0.0/0' };
}

function checkSaKeys(proj) {
  const sas = gcloud('iam service-accounts list', proj);
  if (!sas) return { verdict: 'unknown', detail: 'SA API unavailable' };
  const keyed = [];
  for (const sa of sas) {
    const email = sa.email;
    const keys = gcloud(`iam service-accounts keys list --iam-account=${email}`, proj);
    const userKeys = (keys ?? []).filter(k => k.keyType === 'USER_MANAGED');
    if (userKeys.length > 0) keyed.push(`${sa.displayName || email.split('@')[0]}(${userKeys.length})`);
  }
  if (keyed.length > 0) {
    return { verdict: 'fail', detail: `user-managed SA key(s): ${keyed.join(', ')} — rotate to keyless/WIF & delete` };
  }
  return { verdict: 'pass', detail: 'no user-managed SA keys' };
}

const gcpBundle = {};
const UNKNOWN = (detail) => ({ verdict: 'unknown', detail });

for (const venture of ventures) {
  const proj = venture.gcpProject;
  if (!proj) {
    gcpBundle[venture.id] = {
      signals: {
        iamNoPublicBindings: UNKNOWN('no GCP project configured'),
        iamNoSharedOwner:    UNKNOWN('no GCP project configured'),
        encryptionAtRest:    UNKNOWN('no GCP project configured'),
        bucketsPrivate:      UNKNOWN('no GCP project configured'),
        sqlSslRequired:      UNKNOWN('no GCP project configured'),
        backupsEnabled:      UNKNOWN('no GCP project configured'),
        loggingEnabled:      UNKNOWN('no GCP project configured'),
        wafEnabled:          UNKNOWN('no GCP project configured'),
        mfaEnforced:         UNKNOWN('no GCP project configured'),
        firewallNoOpenIngress: UNKNOWN('no GCP project configured'),
        noUserManagedSaKeys: UNKNOWN('no GCP project configured'),
      },
      meta: { proj: null, available: false },
    };
    continue;
  }

  const iam = checkIamBindings(proj);
  const sql = checkCloudSQL(proj);

  gcpBundle[venture.id] = {
    signals: {
      iamNoPublicBindings: iam.iamNoPublicBindings,
      iamNoSharedOwner:    iam.iamNoSharedOwner,
      encryptionAtRest:    sql.encryptionAtRest,
      bucketsPrivate:      checkBuckets(proj),
      sqlSslRequired:      sql.sqlSslRequired,
      backupsEnabled:      sql.backupsEnabled,
      loggingEnabled:      checkLogging(proj),
      wafEnabled:          checkWaf(proj),
      mfaEnforced:         checkMfa(proj),
      firewallNoOpenIngress: checkFirewall(proj),
      noUserManagedSaKeys: checkSaKeys(proj),
    },
    meta: { proj, available: true },
  };
}

existing.bundles.gcp = gcpBundle;
existing.collectedAt = new Date().toISOString();
writeFileSync(join(ROOT, 'evidence', 'signals.json'), JSON.stringify(existing, null, 2));
console.log(`  gcp signals written for ${ventures.length} ventures`);
