-- Add columns introduced in Antrea v2.6
ALTER TABLE flows
    ADD COLUMN IF NOT EXISTS egressNodeName String;
ALTER TABLE flows_local
    ADD COLUMN IF NOT EXISTS egressNodeName String;
ALTER TABLE flows
    ADD COLUMN IF NOT EXISTS appProtocolName String;
ALTER TABLE flows_local
    ADD COLUMN IF NOT EXISTS appProtocolName String;
ALTER TABLE flows
    ADD COLUMN IF NOT EXISTS httpVals String;
ALTER TABLE flows_local
    ADD COLUMN IF NOT EXISTS httpVals String;
