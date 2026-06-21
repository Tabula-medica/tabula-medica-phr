import { Router, Request, Response } from 'express';
import { interoperabilityHubService } from './services/interoperability-hub-service';
import { logPhiAccess } from './security/hipaa-audit';

const router = Router();

console.log('[InteroperabilityHub] Routes module loaded');

router.get('/source-types', async (req: Request, res: Response) => {
  try {
    const types = interoperabilityHubService.getDataSourceTypes();
    res.json(types);
  } catch (error) {
    console.error('[InteroperabilityHub] Error fetching source types:', error);
    res.status(500).json({ error: 'Failed to fetch source types' });
  }
});

router.get('/data-types', async (req: Request, res: Response) => {
  try {
    const types = interoperabilityHubService.getDataTypes();
    res.json(types);
  } catch (error) {
    console.error('[InteroperabilityHub] Error fetching data types:', error);
    res.status(500).json({ error: 'Failed to fetch data types' });
  }
});

router.get('/protocols', async (req: Request, res: Response) => {
  try {
    const protocols = interoperabilityHubService.getProtocols();
    res.json(protocols);
  } catch (error) {
    console.error('[InteroperabilityHub] Error fetching protocols:', error);
    res.status(500).json({ error: 'Failed to fetch protocols' });
  }
});

router.get('/connections/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || 'anonymous';

    logPhiAccess({
      action: 'read',
      userId,
      patientId,
      resourceType: 'DataSourceConnection',
      details: 'LIST_CONNECTIONS: Retrieved list of data source connections',
    });

    const connections = await interoperabilityHubService.getPatientConnections(patientId);
    res.json(connections);
  } catch (error) {
    console.error('[InteroperabilityHub] Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

router.post('/connections', async (req: Request, res: Response) => {
  try {
    const {
      patientId,
      sourceType,
      sourceName,
      sourceOrganization,
      protocol,
      dataPermissions,
      syncFrequency,
      endpoint,
    } = req.body;
    const userId = (req as any).userId || 'anonymous';

    if (!patientId || !sourceType || !sourceName || !sourceOrganization || !protocol) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const connection = await interoperabilityHubService.createConnection(
      patientId,
      sourceType,
      sourceName,
      sourceOrganization,
      protocol,
      dataPermissions || [],
      syncFrequency || 'manual',
      endpoint,
      userId
    );

    res.json({ success: true, connection });
  } catch (error: any) {
    console.error('[InteroperabilityHub] Error creating connection:', error);
    res.status(500).json({ error: error.message || 'Failed to create connection' });
  }
});

router.patch('/connections/:connectionId', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const updates = req.body;
    const userId = (req as any).userId || 'anonymous';

    const connection = await interoperabilityHubService.updateConnection(connectionId, updates, userId);
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({ success: true, connection });
  } catch (error: any) {
    console.error('[InteroperabilityHub] Error updating connection:', error);
    res.status(500).json({ error: error.message || 'Failed to update connection' });
  }
});

router.delete('/connections/:connectionId', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const userId = (req as any).userId || 'anonymous';

    const deleted = await interoperabilityHubService.deleteConnection(connectionId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[InteroperabilityHub] Error deleting connection:', error);
    res.status(500).json({ error: error.message || 'Failed to delete connection' });
  }
});

router.post('/connections/:connectionId/test', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const userId = (req as any).userId || 'anonymous';

    const result = await interoperabilityHubService.testConnection(connectionId, userId);
    res.json(result);
  } catch (error: any) {
    console.error('[InteroperabilityHub] Error testing connection:', error);
    res.status(500).json({ success: false, message: error.message || 'Connection test failed' });
  }
});

router.post('/connections/:connectionId/sync', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const userId = (req as any).userId || 'anonymous';

    const event = await interoperabilityHubService.syncConnection(connectionId, userId);
    res.json({ success: event.status !== 'failed', event });
  } catch (error: any) {
    console.error('[InteroperabilityHub] Error syncing connection:', error);
    res.status(500).json({ success: false, error: error.message || 'Sync failed' });
  }
});

router.get('/connections/:connectionId/sync-history', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const history = await interoperabilityHubService.getSyncHistory(connectionId);
    res.json(history);
  } catch (error) {
    console.error('[InteroperabilityHub] Error fetching sync history:', error);
    res.status(500).json({ error: 'Failed to fetch sync history' });
  }
});

router.post('/parse/hl7v2', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const userId = (req as any).userId || 'anonymous';

    if (!message) {
      return res.status(400).json({ error: 'Message content required' });
    }

    const parsed = interoperabilityHubService.parseHL7v2(message);
    const fhirBundle = interoperabilityHubService.hl7v2ToFHIR(parsed);

    logPhiAccess({
      action: 'read',
      userId,
      patientId: 'parsing',
      resourceType: 'HL7v2Message',
      details: `PARSE_HL7V2: ${parsed.messageType}^${parsed.triggerEvent} from ${parsed.sendingFacility}`,
    });

    res.json({
      success: true,
      parsed,
      fhirBundle,
    });
  } catch (error: any) {
    console.error('[InteroperabilityHub] Error parsing HL7v2:', error);
    res.status(400).json({ error: error.message || 'Failed to parse HL7v2 message' });
  }
});

router.post('/parse/ccda', async (req: Request, res: Response) => {
  try {
    const { document } = req.body;
    const userId = (req as any).userId || 'anonymous';

    if (!document) {
      return res.status(400).json({ error: 'Document content required' });
    }

    const parsed = interoperabilityHubService.parseCCDA(document);
    const fhirBundle = interoperabilityHubService.ccdaToFHIR(parsed);

    logPhiAccess({
      action: 'read',
      userId,
      patientId: parsed.patient.mrn || 'parsing',
      resourceType: 'CCDADocument',
      details: `PARSE_CCDA: ${parsed.documentType} - ${parsed.title}`,
    });

    res.json({
      success: true,
      parsed: {
        ...parsed,
        rawXml: undefined,
      },
      fhirBundle,
    });
  } catch (error: any) {
    console.error('[InteroperabilityHub] Error parsing CCDA:', error);
    res.status(400).json({ error: error.message || 'Failed to parse CCDA document' });
  }
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { connectionId, protocol, content } = req.body;
    const userId = (req as any).userId || 'anonymous';

    if (!protocol || !content) {
      return res.status(400).json({ error: 'Protocol and content required' });
    }

    const result = await interoperabilityHubService.processIncomingMessage(
      connectionId,
      protocol,
      content,
      userId
    );

    res.json(result);
  } catch (error: any) {
    console.error('[InteroperabilityHub] Error importing data:', error);
    res.status(500).json({ success: false, error: error.message || 'Import failed' });
  }
});

export default router;
