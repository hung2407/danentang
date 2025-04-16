-- Tạo database
CREATE DATABASE parking_management;
USE parking_management;

-- Bảng Users
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Lưu mật khẩu mã hóa
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    role ENUM('customer', 'admin') NOT NULL, -- Chỉ cần customer và admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Vehicles
CREATE TABLE Vehicles (
    vehicle_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- Bảng Parking_Lots
CREATE TABLE Parking_Lots (
    lot_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    total_slots INT NOT NULL,
    available_slots INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Zones
CREATE TABLE Zones (
    zone_id INT PRIMARY KEY AUTO_INCREMENT,
    lot_id INT NOT NULL,
    zone_name VARCHAR(50) NOT NULL,
    total_slots INT NOT NULL,
    available_slots INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lot_id) REFERENCES Parking_Lots(lot_id)
);

-- Bảng Zone_Layouts
CREATE TABLE Zone_Layouts (
    layout_id INT PRIMARY KEY AUTO_INCREMENT,
    zone_id INT NOT NULL,
    layout_type ENUM('grid', 'custom') NOT NULL,
    grid_rows INT, -- Số hàng (nếu là grid)
    grid_cols INT, -- Số cột (nếu là grid)
    layout_data JSON, -- JSON cho sơ đồ tùy chỉnh
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES Zones(zone_id),
    UNIQUE (zone_id)
);

-- Bảng Slots
CREATE TABLE Slots (
    slot_id INT PRIMARY KEY AUTO_INCREMENT,
    zone_id INT NOT NULL,
    slot_code VARCHAR(20) NOT NULL,
    status ENUM('available', 'occupied', 'reserved') NOT NULL,
    position_x INT,
    position_y INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES Zones(zone_id),
    UNIQUE (zone_id, slot_code)
);

-- Bảng Ticket_Prices
CREATE TABLE Ticket_Prices (
    price_id INT PRIMARY KEY AUTO_INCREMENT,
    lot_id INT NOT NULL,
    ticket_type ENUM('daily', 'monthly') NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lot_id) REFERENCES Parking_Lots(lot_id)
);

-- Bảng Bookings
CREATE TABLE Bookings (
    booking_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    lot_id INT NOT NULL,
    slot_id INT NOT NULL,
    ticket_price_id INT NOT NULL,
    booking_type ENUM('daily', 'monthly') NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL,
    qr_code VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    FOREIGN KEY (vehicle_id) REFERENCES Vehicles(vehicle_id),
    FOREIGN KEY (lot_id) REFERENCES Parking_Lots(lot_id),
    FOREIGN KEY (slot_id) REFERENCES Slots(slot_id),
    FOREIGN KEY (ticket_price_id) REFERENCES Ticket_Prices(price_id)
);

-- Bảng Payments
CREATE TABLE Payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('cash', 'card', 'mobile') NOT NULL,
    payment_status ENUM('pending', 'completed', 'failed') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
);

-- Bảng Check_In_Out
CREATE TABLE Check_In_Out (
    check_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    check_in_time DATETIME,
    check_out_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
);

-- Bảng Reports
CREATE TABLE Reports (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    lot_id INT NOT NULL,
    manager_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_bookings INT NOT NULL,
    total_revenue DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lot_id) REFERENCES Parking_Lots(lot_id),
    FOREIGN KEY (manager_id) REFERENCES Users(user_id)
);

-- Trigger để tự động cập nhật available_slots và trạng thái slot khi có đặt chỗ mới
DELIMITER //
CREATE TRIGGER update_available_slots
AFTER INSERT ON Bookings
FOR EACH ROW
BEGIN
    UPDATE Parking_Lots
    SET available_slots = available_slots - 1
    WHERE lot_id = NEW.lot_id AND available_slots > 0;
    
    UPDATE Zones
    SET available_slots = available_slots - 1
    WHERE zone_id = (SELECT zone_id FROM Slots WHERE slot_id = NEW.slot_id) AND available_slots > 0;
    
    UPDATE Slots
    SET status = 'reserved'
    WHERE slot_id = NEW.slot_id;
END //
DELIMITER ;

-- Trigger để khôi phục available_slots và trạng thái slot khi hủy đặt chỗ
DELIMITER //
CREATE TRIGGER restore_available_slots
AFTER UPDATE ON Bookings
FOR EACH ROW
BEGIN
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
        UPDATE Parking_Lots
        SET available_slots = available_slots + 1
        WHERE lot_id = NEW.lot_id;
        
        UPDATE Zones
        SET available_slots = available_slots + 1
        WHERE zone_id = (SELECT zone_id FROM Slots WHERE slot_id = NEW.slot_id);
        
        UPDATE Slots
        SET status = 'available'
        WHERE slot_id = NEW.slot_id;
    END IF;
END //
DELIMITER ;

-- Trigger để cập nhật trạng thái booking thành 'completed' khi check-out
DELIMITER //
CREATE TRIGGER complete_booking_on_checkout
AFTER UPDATE ON Check_In_Out
FOR EACH ROW
BEGIN
    IF NEW.check_out_time IS NOT NULL AND OLD.check_out_time IS NULL THEN
        UPDATE Bookings
        SET status = 'completed'
        WHERE booking_id = NEW.booking_id;
        
        UPDATE Slots
        SET status = 'available'
        WHERE slot_id = (SELECT slot_id FROM Bookings WHERE booking_id = NEW.booking_id);
        
        UPDATE Parking_Lots
        SET available_slots = available_slots + 1
        WHERE lot_id = (SELECT lot_id FROM Bookings WHERE booking_id = NEW.booking_id);
        
        UPDATE Zones
        SET available_slots = available_slots + 1
        WHERE zone_id = (SELECT zone_id FROM Slots WHERE slot_id = (SELECT slot_id FROM Bookings WHERE booking_id = NEW.booking_id));
    END IF;
END //
DELIMITER ;

-- Sử dụng database
USE parking_management;

-- 1. Bảng Users: 5 người dùng (3 khách hàng, 2 admin)
INSERT INTO Users (username, password, full_name, email, phone, role) VALUES
    ('customer1', 'hashed_password_1', 'Nguyễn Văn A', 'customer1@example.com', '0123456789', 'customer'),
    ('customer2', 'hashed_password_2', 'Trần Thị B', 'customer2@example.com', '0987654321', 'customer'),
    ('customer3', 'hashed_password_3', 'Lê Văn C', 'customer3@example.com', '0912345678', 'customer'),
    ('admin1', 'hashed_password_4', 'Phạm Văn D', 'admin1@example.com', '0934567890', 'admin'),
    ('admin2', 'hashed_password_5', 'Hoàng Thị E', 'admin2@example.com', '0945678901', 'admin');

-- 2. Bảng Vehicles: 5 xe ô tô (thuộc 3 khách hàng)
INSERT INTO Vehicles (user_id, license_plate, vehicle_type) VALUES
    (1, '30A-12345', 'sedan'),
    (1, '30A-67890', 'suv'),
    (2, '29B-54321', 'sedan'),
    (2, '29B-98765', 'hatchback'),
    (3, '51C-11111', 'suv');

-- 3. Bảng Parking_Lots: 5 bãi xe
INSERT INTO Parking_Lots (name, address, total_slots, available_slots) VALUES
    ('Bãi xe Trung Tâm', '123 Đường Láng, Hà Nội', 100, 95),
    ('Bãi xe Nam Thành', '456 Lê Lợi, TP.HCM', 80, 78),
    ('Bãi xe Bắc Hải', '789 Trần Phú, Đà Nẵng', 50, 48),
    ('Bãi xe Đông Anh', '101 Quốc lộ 1A, Hà Nội', 120, 118),
    ('Bãi xe Tây Hồ', '222 Lạc Long Quân, Hà Nội', 60, 58);

-- 4. Bảng Zones: 5 khu (thuộc 2 bãi xe)
INSERT INTO Zones (lot_id, zone_name, total_slots, available_slots) VALUES
    (1, 'Khu A', 30, 28),
    (1, 'Khu B', 20, 19),
    (1, 'Khu C', 25, 24),
    (2, 'Khu X', 40, 39),
    (2, 'Khu Y', 30, 29);

-- 5. Bảng Zone_Layouts: 5 cấu hình sơ đồ (cho 5 khu)
INSERT INTO Zone_Layouts (zone_id, layout_type, grid_rows, grid_cols, layout_data) VALUES
    (1, 'grid', 5, 6, NULL), -- Khu A: Lưới 5x6
    (2, 'grid', 4, 5, NULL), -- Khu B: Lưới 4x5
    (3, 'grid', 5, 5, NULL), -- Khu C: Lưới 5x5
    (4, 'custom', NULL, NULL, '{"shape": "rectangle", "slots": [{"code": "X1", "x": 10, "y": 10}]}'), -- Khu X: Tùy chỉnh
    (5, 'grid', 6, 5, NULL); -- Khu Y: Lưới 6x5

-- 6. Bảng Slots: 5 chỗ đỗ (thuộc 3 khu)
INSERT INTO Slots (zone_id, slot_code, status, position_x, position_y) VALUES
    (1, 'A1', 'available', 1, 1),
    (1, 'A2', 'reserved', 1, 2),
    (2, 'B1', 'available', 1, 1),
    (3, 'C1', 'available', 2, 1),
    (4, 'X1', 'reserved', 1, 1);

-- 7. Bảng Ticket_Prices: 5 giá vé (cho 2 bãi xe)
INSERT INTO Ticket_Prices (lot_id, ticket_type, price, valid_from, valid_to) VALUES
    (1, 'daily', 20000, '2025-01-01', NULL), -- 20,000 VND/giờ
    (1, 'monthly', 500000, '2025-01-01', NULL), -- 500,000 VND/tháng
    (2, 'daily', 25000, '2025-01-01', NULL), -- 25,000 VND/giờ
    (2, 'monthly', 600000, '2025-01-01', NULL), -- 600,000 VND/tháng
    (1, 'daily', 18000, '2025-04-01', '2025-04-30'); -- Giá khuyến mãi tháng 4

-- 8. Bảng Bookings: 5 đặt chỗ (3 vé ngày, 2 vé tháng)
INSERT INTO Bookings (user_id, vehicle_id, lot_id, slot_id, ticket_price_id, booking_type, start_time, end_time, status, qr_code) VALUES
    (1, 1, 1, 2, 1, 'daily', '2025-04-16 08:00:00', '2025-04-16 17:00:00', 'pending', 'QR12345'), -- 9 giờ
    (2, 3, 1, 5, 2, 'monthly', '2025-04-16 00:00:00', '2025-05-15 23:59:59', 'confirmed', 'QR67890'),
    (3, 5, 2, 5, 3, 'daily', '2025-04-17 09:00:00', '2025-04-17 15:00:00', 'confirmed', 'QR54321'), -- 6 giờ
    (1, 2, 2, 5, 4, 'monthly', '2025-04-18 00:00:00', '2025-05-17 23:59:59', 'pending', 'QR98765'),
    (2, 4, 1, 2, 5, 'daily', '2025-04-19 10:00:00', '2025-04-19 16:00:00', 'cancelled', 'QR11223'); -- 6 giờ, khuyến mãi

-- 9. Bảng Payments: 5 thanh toán (cho 5 đặt chỗ)
INSERT INTO Payments (booking_id, amount, payment_method, payment_status) VALUES
    (1, 180000, 'mobile', 'pending'), -- 20,000 × 9 giờ
    (2, 500000, 'card', 'completed'), -- Vé tháng
    (3, 150000, 'cash', 'completed'), -- 25,000 × 6 giờ
    (4, 600000, 'mobile', 'pending'), -- Vé tháng
    (5, 108000, 'card', 'completed'); -- 18,000 × 6 giờ (khuyến mãi)

-- 10. Bảng Check_In_Out: 5 bản ghi (3 check-in, 2 check-in và check-out)
INSERT INTO Check_In_Out (booking_id, check_in_time, check_out_time) VALUES
    (1, '2025-04-16 08:05:00', NULL), -- Đã check-in
    (2, '2025-04-16 09:00:00', NULL), -- Đã check-in
    (3, '2025-04-17 09:10:00', '2025-04-17 15:05:00'), -- Đã check-in và check-out
    (4, '2025-04-18 08:30:00', NULL), -- Đã check-in
    (5, '2025-04-19 10:15:00', '2025-04-19 16:10:00'); -- Đã check-in và check-out

-- 11. Bảng Reports: 5 báo cáo (cho 2 bãi xe)
INSERT INTO Reports (lot_id, manager_id, start_date, end_date, total_bookings, total_revenue) VALUES
    (1, 4, '2025-04-01', '2025-04-30', 50, 9000000), -- Bãi 1, tháng 4
    (1, 4, '2025-03-01', '2025-03-31', 45, 8500000), -- Bãi 1, tháng 3
    (2, 5, '2025-04-01', '2025-04-30', 30, 7500000), -- Bãi 2, tháng 4
    (2, 5, '2025-03-01', '2025-03-31', 25, 7000000), -- Bãi 2, tháng 3
    (1, 4, '2025-02-01', '2025-02-28', 40, 8000000); -- Bãi 1, tháng 2 