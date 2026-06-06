-- Remove columns added in Antrea v2.6 migration
ALTER TABLE flows
    DROP COLUMN IF EXISTS egressNodeName;
ALTER TABLE flows_local
    DROP COLUMN IF EXISTS egressNodeName;
ALTER TABLE flows
    DROP COLUMN IF EXISTS appProtocolName;
ALTER TABLE flows_local
    DROP COLUMN IF EXISTS appProtocolName;
ALTER TABLE flows
    DROP COLUMN IF EXISTS httpVals;
ALTER TABLE flows_local
    DROP COLUMN IF EXISTS httpVals;
