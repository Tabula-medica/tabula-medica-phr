---
name: mcp-sentry
description: 'Call tools from the Sentry MCP server through code_execution callbacks. Available tools: mcpSentry_analyzeIssueWithSeer, mcpSentry_findOrganizations, mcpSentry_findProjects, mcpSentry_findReleases, mcpSentry_findTeams, mcpSentry_getEventAttachment, mcpSentry_getIssueTagValues, mcpSentry_getProfileDetails, mcpSentry_getReplayDetails, mcpSentry_getSentryResource, mcpSentry_searchEvents, mcpSentry_searchIssueEvents, mcpSentry_searchIssues, mcpSentry_whoami. Reference skill for more information.'
---

# MCP Skill: Sentry

Use this skill when you need data or actions from this MCP server.

## Available Functions

### mcpSentry_analyzeIssueWithSeer(...)

Use Seer to analyze production errors and get detailed root cause analysis with specific code fixes.

Use this tool when:
- The user explicitly asks for root cause analysis, Seer analysis, or help fixing/debugging an issue
- You are unable to accurately determine the root cause from the issue details alone

Do NOT call this tool as an automatic follow-up to get_sentry_resource.

What this tool provides:
- Root cause analysis with code-level explanations
- Specific file locations and line numbers where errors occur
- Concrete code fixes you can apply
- Step-by-step implementation guidance

This tool automatically:
1. Checks if analysis already exists (instant results)
2. Starts new AI analysis if needed (~2-5 minutes)
3. Returns complete fix recommendations

<examples>
### User: "Run Seer on this issue"

```
analyze_issue_with_seer(issueUrl='https://my-org.sentry.io/issues/PROJECT-1Z43')
```

### User: "Analyze this issue and suggest a fix"

```
analyze_issue_with_seer(organizationSlug='my-organization', issueId='ERROR-456')
```
</examples>

<hints>
- Only use when the user explicitly requests analysis or you cannot determine the root cause from issue details alone
- If the user provides an issueUrl, extract it and use that parameter alone
- The analysis includes actual code snippets and fixes, not just error descriptions
- Results are cached - subsequent calls return instantly
</hints>

**Parameters:**

- `organizationSlug` (string, optional): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.
- `regionUrl` (any, optional): The region URL for the organization you're querying, if known. For Sentry's Cloud Service (sentry.io), this is typically the region-specific URL like 'https://us.sentry.io'. For self-hosted Sentry installations, this parameter is usually not needed and should be omitted. You can find the correct regionUrl from the organization details using the `find_organizations()` tool.
- `issueId` (string, optional): The Issue ID. e.g. `PROJECT-1Z43`
- `issueUrl` (string, optional): The URL of the issue. e.g. https://my-organization.sentry.io/issues/PROJECT-1Z43
- `instruction` (string, optional): Optional custom instruction for the AI analysis

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_analyzeIssueWithSeer({ organizationSlug: "", regionUrl: null, issueId: "", issueUrl: "", instruction: "" });
console.log(result);
```

### mcpSentry_findOrganizations(...)

Find organizations that the user has access to in Sentry.

Use this tool when you need to:
- View organizations in Sentry
- Find an organization's slug to aid other tool requests
- Search for specific organizations by name or slug

Returns up to 25 results. If you hit this limit, use the query parameter to narrow down results.

**Parameters:**

- `query` (any, optional): Search query to filter results by name or slug. Use this to narrow down results when there are many items.

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_findOrganizations({ query: null });
console.log(result);
```

### mcpSentry_findProjects(...)

Find projects in Sentry.

Use this tool when you need to:
- View projects in a Sentry organization
- Find a project's slug to aid other tool requests
- Search for specific projects by name or slug

Returns up to 25 results. If you hit this limit, use the query parameter to narrow down results.

**Parameters:**

- `organizationSlug` (string, required): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.
- `regionUrl` (any, optional): The region URL for the organization you're querying, if known. For Sentry's Cloud Service (sentry.io), this is typically the region-specific URL like 'https://us.sentry.io'. For self-hosted Sentry installations, this parameter is usually not needed and should be omitted. You can find the correct regionUrl from the organization details using the `find_organizations()` tool.
- `query` (any, optional): Search query to filter results by name or slug. Use this to narrow down results when there are many items.

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_findProjects({ organizationSlug: "", regionUrl: null, query: null });
console.log(result);
```

### mcpSentry_findReleases(...)

Find releases in Sentry.

Use this tool when you need to:
- Find recent releases in a Sentry organization
- Find the most recent version released of a specific project
- Determine when a release was deployed to an environment

<examples>
### Find the most recent releases in the 'my-organization' organization

```
find_releases(organizationSlug='my-organization')
```

### Find releases matching '2ce6a27' in the 'my-organization' organization

```
find_releases(organizationSlug='my-organization', query='2ce6a27')
```
</examples>

<hints>
- If the user passes a parameter in the form of name/otherName, its likely in the format of <organizationSlug>/<projectSlug>.
</hints>

**Parameters:**

- `organizationSlug` (string, required): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.
- `regionUrl` (any, optional): The region URL for the organization you're querying, if known. For Sentry's Cloud Service (sentry.io), this is typically the region-specific URL like 'https://us.sentry.io'. For self-hosted Sentry installations, this parameter is usually not needed and should be omitted. You can find the correct regionUrl from the organization details using the `find_organizations()` tool.
- `projectSlug` (any, optional): The project's slug. This will default to all projects you have access to. It is encouraged to specify this when possible.
- `query` (any, optional): Search for versions which contain the provided string.

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_findReleases({ organizationSlug: "", regionUrl: null, projectSlug: null, query: null });
console.log(result);
```

### mcpSentry_findTeams(...)

Find teams in an organization in Sentry.

Use this tool when you need to:
- View teams in a Sentry organization
- Find a team's slug and numeric ID to aid other tool requests
- Search for specific teams by name or slug

Returns up to 25 results. If you hit this limit, use the query parameter to narrow down results.

**Parameters:**

- `organizationSlug` (string, required): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.
- `regionUrl` (any, optional): The region URL for the organization you're querying, if known. For Sentry's Cloud Service (sentry.io), this is typically the region-specific URL like 'https://us.sentry.io'. For self-hosted Sentry installations, this parameter is usually not needed and should be omitted. You can find the correct regionUrl from the organization details using the `find_organizations()` tool.
- `query` (any, optional): Search query to filter results by name or slug. Use this to narrow down results when there are many items.

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_findTeams({ organizationSlug: "", regionUrl: null, query: null });
console.log(result);
```

### mcpSentry_getEventAttachment(...)

Download attachments from a Sentry event.

Use this tool when you need to:
- Download files attached to a specific event
- Access screenshots, log files, or other attachments uploaded with an error report
- Retrieve attachment metadata and download URLs

<examples>
### Download a specific attachment by ID

```
get_event_attachment(organizationSlug='my-organization', projectSlug='my-project', eventId='c49541c747cb4d8aa3efb70ca5aba243', attachmentId='12345')
```

### List all attachments for an event

```
get_event_attachment(organizationSlug='my-organization', projectSlug='my-project', eventId='c49541c747cb4d8aa3efb70ca5aba243')
```

</examples>

<hints>
- If `attachmentId` is provided, the specific attachment will be downloaded as an embedded resource
- If `attachmentId` is omitted, all attachments for the event will be listed with download information
- The `projectSlug` is required to identify which project the event belongs to
</hints>

**Parameters:**

- `organizationSlug` (string, required): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.
- `projectSlug` (string, required): The project's slug. You can find a list of existing projects in an organization using the `find_projects()` tool.
- `eventId` (string, required): The ID of the event.
- `attachmentId` (any, optional): The ID of the attachment to download.
- `regionUrl` (any, optional): The region URL for the organization you're querying, if known. For Sentry's Cloud Service (sentry.io), this is typically the region-specific URL like 'https://us.sentry.io'. For self-hosted Sentry installations, this parameter is usually not needed and should be omitted. You can find the correct regionUrl from the organization details using the `find_organizations()` tool.

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_getEventAttachment({ organizationSlug: "", projectSlug: "", eventId: "", attachmentId: null, regionUrl: null });
console.log(result);
```

### mcpSentry_getIssueTagValues(...)

Get tag value distribution for a specific Sentry issue.

Use this tool when you need to:
- Understand how an issue is distributed across different tag values
- Get aggregate counts of unique tag values (e.g., 'how many unique URLs are affected')
- Analyze which browsers, environments, or URLs are most impacted by an issue
- View the tag distributions page data programmatically

Common tag keys:
- `url`: Request URLs affected by the issue
- `browser`: Browser types and versions
- `browser.name`: Browser names only
- `os`: Operating systems
- `environment`: Deployment environments (production, staging, etc.)
- `release`: Software releases
- `device`: Device types
- `user`: Affected users

<examples>
### Get URL distribution for an issue
```
get_issue_tag_values(organizationSlug='my-organization', issueId='PROJECT-123', tagKey='url')
```

### Get browser distribution using issue URL
```
get_issue_tag_values(issueUrl='https://sentry.io/issues/PROJECT-123/', tagKey='browser')
```

### Get environment distribution
```
get_issue_tag_values(organizationSlug='my-organization', issueId='PROJECT-123', tagKey='environment')
```
</examples>

<hints>
- If user provides a Sentry URL, pass the ENTIRE URL to issueUrl parameter unchanged
- Common tag keys: url, browser, browser.name, os, environment, release, device, user
- Tag keys are case-sensitive
</hints>

**Parameters:**

- `organizationSlug` (string, optional): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.
- `regionUrl` (any, optional): The region URL for the organization you're querying, if known. For Sentry's Cloud Service (sentry.io), this is typically the region-specific URL like 'https://us.sentry.io'. For self-hosted Sentry installations, this parameter is usually not needed and should be omitted. You can find the correct regionUrl from the organization details using the `find_organizations()` tool.
- `issueId` (string, optional): The Issue ID. e.g. `PROJECT-1Z43`
- `issueUrl` (string, optional): The URL of the issue. e.g. https://my-organization.sentry.io/issues/PROJECT-1Z43
- `tagKey` (string, required): The tag key to get values for (e.g., 'url', 'browser', 'environment', 'release').

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_getIssueTagValues({ organizationSlug: "", regionUrl: null, issueId: "", issueUrl: "", tagKey: "" });
console.log(result);
```

### mcpSentry_getProfileDetails(...)

Inspect a specific Sentry profile in detail.

USE THIS TOOL WHEN:
- User shares a transaction profile URL and wants the details
- User has a profile ID and wants a concise summary plus raw sample structure
- User needs to inspect a continuous profile session by profiler ID and time range

RETURNS:
- Transaction profile summary with profile URL, transaction, trace, release, and runtime details
- Sample structure summaries such as frame count, sample count, stacks, and thread breakdown
- Top frames by occurrence for a quick hotspot overview

NOTE: This tool supports two profile modes.
- Transaction profiles: pass `profileUrl` or `organizationSlug` + `projectSlugOrId` + `profileId`
- Continuous profiles: pass `profileUrl` or `organizationSlug` + `projectSlugOrId` + `profilerId` + `start` + `end`

<examples>
### Transaction profile URL
```
get_profile_details(
  profileUrl='https://my-org.sentry.io/explore/profiling/profile/backend/cfe78a5c892d4a64a962d837673398d2/flamegraph/'
)
```

### Transaction profile by ID
```
get_profile_details(
  organizationSlug='my-org',
  projectSlugOrId='backend',
  profileId='cfe78a5c892d4a64a962d837673398d2'
)
```

### Continuous profile by session
```
get_profile_details(
  organizationSlug='my-org',
  projectSlugOrId='backend',
  profilerId='041bde57b9844e36b8b7e5734efae5f7',
  start='2024-01-01T00:00:00Z',
  end='2024-01-01T01:00:00Z'
)
```
</examples>

**Parameters:**

- `profileUrl` (string, optional): Sentry transaction profile or continuous profile URL. If provided, organization, project, and profile identifiers are extracted from the URL.
- `organizationSlug` (string, optional): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.
- `regionUrl` (any, optional): The region URL for the organization you're querying, if known. For Sentry's Cloud Service (sentry.io), this is typically the region-specific URL like 'https://us.sentry.io'. For self-hosted Sentry installations, this parameter is usually not needed and should be omitted. You can find the correct regionUrl from the organization details using the `find_organizations()` tool.
- `projectSlugOrId` (string | number, optional): Project slug or numeric ID
- `profileId` (string, optional): Transaction profile ID from a profile flamegraph URL
- `profilerId` (string, optional): Continuous profiler session ID
- `start` (string, optional): Continuous profile start time in ISO 8601 format, for example '2024-01-01T00:00:00Z'
- `end` (string, optional): Continuous profile end time in ISO 8601 format, for example '2024-01-01T01:00:00Z'
- `focusOnUserCode` (boolean, optional): Show only user code frames in the hotspot table. Set to false to include library frames.

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_getProfileDetails({ profileUrl: "", organizationSlug: "", regionUrl: null, projectSlugOrId: "", profileId: "", profilerId: "", start: "", end: "", focusOnUserCode: true });
console.log(result);
```

### mcpSentry_getReplayDetails(...)

Get high-level information about a specific Sentry replay by URL or replay ID.

USE THIS TOOL WHEN USERS:
- Share a replay URL
- Ask what happened in a specific replay
- Want a concise replay summary plus the next issue or trace lookups to run

<examples>
### With replay URL
```
get_replay_details(replayUrl='https://my-organization.sentry.io/explore/replays/7e07485f-12f9-416b-8b14-26260799b51f/')
```

### With organization and replay ID
```
get_replay_details(organizationSlug='my-organization', replayId='7e07485f-12f9-416b-8b14-26260799b51f')
```
</examples>

**Parameters:**

- `replayUrl` (string, optional): The URL of the replay. e.g. https://my-organization.sentry.io/explore/replays/7e07485f-12f9-416b-8b14-26260799b51f/
- `organizationSlug` (string, optional): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.
- `replayId` (string, optional): The replay ID. e.g. `7e07485f-12f9-416b-8b14-26260799b51f`
- `regionUrl` (any, optional): The region URL for the organization you're querying, if known. For Sentry's Cloud Service (sentry.io), this is typically the region-specific URL like 'https://us.sentry.io'. For self-hosted Sentry installations, this parameter is usually not needed and should be omitted. You can find the correct regionUrl from the organization details using the `find_organizations()` tool.

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_getReplayDetails({ replayUrl: "", organizationSlug: "", replayId: "", regionUrl: "" });
console.log(result);
```

### mcpSentry_getSentryResource(...)

Fetch a Sentry resource by URL or by type and ID. Pass a Sentry URL directly and the resource type is auto-detected.

Supports issues, events, traces, spans, AI conversations, replays, breadcrumbs, and preprod snapshots.
Sentry URLs require authentication that this tool handles.
Trace lookups return a condensed overview by default.

For preprod snapshot URLs (matching 'sentry.io/preprod/snapshots/'):
- Without ?selectedSnapshot=: returns the snapshot diff summary (changed, added, removed images)
- With ?selectedSnapshot=<image_file_name>: returns the specific image and full metadata

For `resourceType='span'`, pass `resourceId` as `<traceId>:<spanId>`.

<examples>
### From a Sentry URL
get_sentry_resource(url='https://sentry.io/issues/PROJECT-123/')

### Breadcrumbs from a Sentry URL
get_sentry_resource(url='https://sentry.io/issues/PROJECT-123/', resourceType='breadcrumbs')

### By type and ID
get_sentry_resource(resourceType='issue', organizationSlug='my-org', resourceId='PROJECT-123')

### Span by trace and span ID
get_sentry_resource(resourceType='span', organizationSlug='my-org', resourceId='a4d1aae7216b47ff8117cf4e09ce9d0a:aa8e7f3384ef4ff5')

### Replay by ID
get_sentry_resource(resourceType='replay', organizationSlug='my-org', resourceId='7e07485f-12f9-416b-8b14-26260799b51f')

### AI conversation by ID
get_sentry_resource(resourceType='ai_conversation', organizationSlug='my-org', resourceId='conversation-123')

### Investigate a failed snapshot test from CI
get_sentry_resource(url='https://sentry.sentry.io/preprod/snapshots/241539/')

### View a specific changed snapshot image
get_sentry_resource(url='https://sentry.sentry.io/preprod/snapshots/241539/?selectedSnapshot=login_screen.png')
</examples>

**Parameters:**

- `url` (string, optional): Sentry URL. The resource type is auto-detected from the URL pattern.
- `resourceType` (string, optional): Resource type. With a URL, can override the auto-detected type for breadcrumbs on an issue/event URL or for `trace` on a span-focused trace URL.
- `resourceId` (string, optional): Resource identifier: issue shortId (e.g., 'PROJECT-123'), event ID, trace ID, AI conversation ID, replay ID, or `traceId:spanId` for span resources. Required when not using a URL.
- `organizationSlug` (string, optional): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_getSentryResource({ url: "", resourceType: "issue", resourceId: "", organizationSlug: "" });
console.log(result);
```

### mcpSentry_searchEvents(...)

Search Sentry events and replays. Use for event counts/statistics.

`query` can be natural language or Sentry search syntax. With an agent configured, it fixes dataset, query, fields, and sort before running.

Supports TWO query types:
1. AGGREGATIONS (counts, sums, averages): 'how many errors', 'total tokens'
2. Individual events with timestamps: 'error logs from last hour'

Datasets:
- errors: Exception/crash events with stack traces, usually grouped into issues
- logs: Application log entries, including error-severity log messages
- spans: Raw trace/span events for performance, AI/LLM calls, requests, and operations
- metrics: Metric rows and aggregates: counters, gauges, distributions, values
- profiles: Transaction/continuous profile results, profile IDs, profiled transactions
- replays: Session replay results: rage clicks, dead clicks, visited pages, replay users
If the user says logs, log messages, error logs, or warning logs, choose logs instead of errors.

Replay searches return replay lists only; replay count()/avg()/sum() are not supported.

NOT for grouped issue lists (use search_issues) or app screenshots/images (use get_latest_base_snapshot).

<examples>
search_events(organizationSlug='my-org', query='how many errors today')
search_events(organizationSlug='my-org', dataset='errors', query='level:error')
search_events(organizationSlug='my-org', dataset='errors', fields=['issue', 'count()'], sort='-count()')
search_events(organizationSlug='my-org', dataset='spans', query='span.op:db', sort='-span.duration')
search_events(organizationSlug='my-org', dataset='replays', query='count_errors:>0', sort='-count_errors')
</examples>

<hints>
- If the user passes a parameter in the form of name/otherName, it's likely in the format of <organizationSlug>/<projectSlug>.
- Parse org/project notation directly without calling find_organizations or find_projects.
- Use fields with aggregate functions like count(), avg(), sum() for statistics
- Sort by -count() for most common, -timestamp for newest
</hints>

**Parameters:**

- `organizationSlug` (string, required): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.
- `dataset` (string, optional): Initial dataset hint: errors, logs, spans, metrics, profiles, or replays. The agent may correct this when configured.
- `query` (string, optional): Natural language or Sentry event search query syntax.
- `fields` (any, optional): Fields to return for event datasets. If not specified, uses sensible defaults. Include aggregate functions like count(), avg() for statistics. Leave null for dataset='replays'.
- `sort` (any, optional): Sort field (prefix with - for descending). If omitted, event datasets default to -timestamp and replays default to -started_at. Use -count() for event aggregations. For dataset='replays', use replay sorts like -started_at or -count_errors.
- `projectSlug` (any, optional): The project's slug. You can find a list of existing projects in an organization using the `find_projects()` tool.
- `environment` (any, optional): Optional environment filter for dataset='replays'. Use a string for one environment or an array for multiple. For other datasets, filter environment in the query string instead.
- `statsPeriod` (string, optional): Initial time period hint: 1h, 24h, 7d, 14d, 30d, etc.
- `regionUrl` (any, optional): The region URL for the organization you're querying, if known. For Sentry's Cloud Service (sentry.io), this is typically the region-specific URL like 'https://us.sentry.io'. For self-hosted Sentry installations, this parameter is usually not needed and should be omitted. You can find the correct regionUrl from the organization details using the `find_organizations()` tool.
- `limit` (number, optional): Maximum number of results to return (1-100)
- `includeExplanation` (boolean, optional): Include explanation of how the query was translated or repaired

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_searchEvents({ organizationSlug: "", dataset: "spans", query: "", fields: "", sort: "", projectSlug: null, environment: "", statsPeriod: "", regionUrl: null, limit: 10, includeExplanation: false });
console.log(result);
```

### mcpSentry_searchIssueEvents(...)

Search and filter events within a specific issue.

Provide `query` as natural language or Sentry event search syntax. When an embedded agent is configured, it fixes filters, fields, sort, and time range before running.

The tool automatically constrains results to the specified issue.

Common Query Filters:
- environment:production - Filter by environment
- release:1.0.0 - Filter by release version
- user.email:alice@example.com - Filter by user
- trace:TRACE_ID - Filter by trace ID

For cross-issue searches use search_issues. For single issue or event details use get_sentry_resource.

<examples>
search_issue_events(issueId='MCP-41', organizationSlug='my-org', query='from last hour')
search_issue_events(issueId='MCP-41', organizationSlug='my-org', query='environment:production')
search_issue_events(issueUrl='https://sentry.io/.../issues/123/', query='release:v1.0.0', statsPeriod='7d')
</examples>

**Parameters:**

- `organizationSlug` (any, optional): Organization slug. Required when using issueId. Not needed when using issueUrl.
- `issueId` (string, optional): Issue ID (e.g., 'MCP-41', 'PROJECT-123'). Requires organizationSlug. Alternatively, use issueUrl.
- `issueUrl` (string, optional): Full Sentry issue URL (e.g., 'https://sentry.io/organizations/my-org/issues/123/'). Includes both organization and issue ID.
- `query` (string, optional): Natural language or Sentry event search query syntax for filtering within the issue.
- `sort` (string, optional): Sort field (prefix with - for descending). Default: -timestamp
- `statsPeriod` (string, optional): Initial time period hint: 1h, 24h, 7d, 14d, 30d, etc.
- `projectSlug` (any, optional): Project slug for better tag discovery. Optional - helps find project-specific tags.
- `regionUrl` (any, optional): Sentry region URL. Optional - defaults to main region.
- `limit` (number, optional): Maximum number of events to return (1-100, default: 50)
- `includeExplanation` (boolean, optional): Include explanation of how the query was translated or repaired

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_searchIssueEvents({ organizationSlug: null, issueId: "", issueUrl: "", query: "", sort: "", statsPeriod: "", projectSlug: null, regionUrl: null, limit: 50, includeExplanation: false });
console.log(result);
```

### mcpSentry_searchIssues(...)

Search for grouped issues/problems in Sentry - returns a LIST of issues, NOT counts or aggregations.

Provide `query` as natural language or Sentry issue search syntax. When an embedded agent is configured, it fixes query and sort before running.

Returns grouped issues with metadata like title, status, and user count.

Common Query Syntax:
- is:unresolved / is:resolved / is:ignored
- level:error / level:warning
- firstSeen:-24h / lastSeen:-7d
- assigned:me / assignedOrSuggested:me
- issueCategory:feedback
- environment:production
- userCount:>100

DO NOT USE FOR COUNTS/AGGREGATIONS → use search_events
DO NOT USE FOR individual events with timestamps → use search_events
DO NOT USE FOR details about a specific issue → use get_sentry_resource

<examples>
search_issues(organizationSlug='my-org', query='critical bugs from last week')
search_issues(organizationSlug='my-org', query='is:unresolved is:unassigned', sort='freq')
search_issues(organizationSlug='my-org', query='level:error firstSeen:-24h', projectSlugOrId='my-project')
</examples>

<hints>
- If the user passes a parameter in the form of name/otherName, it's likely in the format of <organizationSlug>/<projectSlugOrId>.
- Parse org/project notation directly without calling find_organizations or find_projects.
- The projectSlugOrId parameter accepts both project slugs (e.g., 'my-project') and numeric IDs (e.g., '123456').
</hints>

**Parameters:**

- `organizationSlug` (string, required): The organization's slug. You can find a existing list of organizations you have access to using the `find_organizations()` tool.
- `query` (string, optional): Natural language or Sentry issue search query syntax.
- `sort` (string, optional): Sort order: date (last seen), freq (frequency), new (first seen), user (user count)
- `projectSlugOrId` (any, optional): The project's slug or numeric ID (optional)
- `regionUrl` (any, optional): The region URL for the organization you're querying, if known. For Sentry's Cloud Service (sentry.io), this is typically the region-specific URL like 'https://us.sentry.io'. For self-hosted Sentry installations, this parameter is usually not needed and should be omitted. You can find the correct regionUrl from the organization details using the `find_organizations()` tool.
- `limit` (number, optional): Maximum number of issues to return (1-100)
- `includeExplanation` (boolean, optional): Include explanation of how the query was translated or repaired

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_searchIssues({ organizationSlug: "", query: "is:unresolved", sort: "date", projectSlugOrId: null, regionUrl: null, limit: 10, includeExplanation: false });
console.log(result);
```

### mcpSentry_whoami(...)

Identify the authenticated user in Sentry.

Use this tool when you need to:
- Get the user's name and email address.

**Parameters:** None.

**Returns:** Object with `status`, `content`, and optional metadata.

**Example:**

```javascript
const result = await mcpSentry_whoami();
console.log(result);
```

## Blocked Tools

- None

## Notes

- Call these functions directly in `code_execution` JavaScript.
- These are pre-registered callbacks available in the sandbox; no imports needed.
