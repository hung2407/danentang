-- Modify payment_method column to include 'vnpay' option
ALTER TABLE Payments MODIFY COLUMN payment_method ENUM('cash', 'card', 'mobile', 'vnpay') NOT NULL; 