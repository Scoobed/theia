-- Add egressNodeName column to flows table (introduced in Antrea v2.6)
ALTER TABLE flows
    ADD COLUMN egressNodeName String;
ALTER TABLE flows_local
    ADD COLUMN egressNodeName String;
