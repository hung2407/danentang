-- Add reference_id column to Payments table
ALTER TABLE Payments ADD COLUMN reference_id VARCHAR(100) NULL;

-- Create index for faster lookup
CREATE INDEX idx_payments_reference_id ON Payments(reference_id); 