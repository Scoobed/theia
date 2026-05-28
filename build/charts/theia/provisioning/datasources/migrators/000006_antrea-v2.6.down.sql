-- Remove egressNodeName column added in Antrea v2.6 migration
ALTER TABLE flows
    DROP COLUMN egressNodeName;
ALTER TABLE flows_local
    DROP COLUMN egressNodeName;
