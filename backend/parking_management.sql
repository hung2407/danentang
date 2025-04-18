-- Tạo cơ sở dữ liệu
DROP DATABASE IF EXISTS parking_management;
CREATE DATABASE parking_management;
USE parking_management;

-- Tạo các bảng
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    role ENUM('customer', 'admin') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Vehicles (
    vehicle_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE Zones (
    zone_id INT PRIMARY KEY AUTO_INCREMENT,
    zone_name VARCHAR(50) NOT NULL,
    total_slots INT NOT NULL,
    available_slots INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Zone_Layouts (
    layout_id INT PRIMARY KEY AUTO_INCREMENT,
    zone_id INT NOT NULL,
    layout_type ENUM('grid', 'custom') NOT NULL,
    grid_rows INT,
    grid_cols INT,
    layout_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES Zones(zone_id),
    UNIQUE (zone_id)
);

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

CREATE TABLE Ticket_Prices (
    price_id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_type ENUM('daily', 'monthly') NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Bookings (
    booking_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
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
    FOREIGN KEY (slot_id) REFERENCES Slots(slot_id),
    FOREIGN KEY (ticket_price_id) REFERENCES Ticket_Prices(price_id)
);

CREATE TABLE Payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('cash', 'card', 'mobile') NOT NULL,
    payment_status ENUM('pending', 'completed', 'failed') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
);

CREATE TABLE Check_In_Out (
    check_id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    check_in_time DATETIME,
    check_out_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id)
);

CREATE TABLE Reports (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    manager_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_bookings INT NOT NULL,
    total_revenue DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES Users(user_id)
);

-- Trigger
DELIMITER //
CREATE TRIGGER update_available_slots
AFTER INSERT ON Bookings
FOR EACH ROW
BEGIN
    UPDATE Zones
    SET available_slots = available_slots - 1
    WHERE zone_id = (SELECT zone_id FROM Slots WHERE slot_id = NEW.slot_id) AND available_slots > 0;
    
    UPDATE Slots
    SET status = 'reserved'
    WHERE slot_id = NEW.slot_id;
END //
DELIMITER ;

DELIMITER //
CREATE TRIGGER restore_available_slots
AFTER UPDATE ON Bookings
FOR EACH ROW
BEGIN
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
        UPDATE Zones
        SET available_slots = available_slots + 1
        WHERE zone_id = (SELECT zone_id FROM Slots WHERE slot_id = NEW.slot_id);
        
        UPDATE Slots
        SET status = 'available'
        WHERE slot_id = NEW.slot_id;
    END IF;
END //
DELIMITER ;

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
        
        UPDATE Zones
        SET available_slots = available_slots + 1
        WHERE zone_id = (SELECT zone_id FROM Slots WHERE slot_id = (SELECT slot_id FROM Bookings WHERE booking_id = NEW.booking_id));
    END IF;
END //
DELIMITER ;

-- Chèn dữ liệu mẫu
-- 1. Users
INSERT INTO Users (user_id, username, password, full_name, email, phone, role) VALUES
    (1, 'student1', 'hashed_password_1', 'Nguyễn Văn A', 'student1@school.edu.vn', '0123456789', 'customer'),
    (2, 'student2', 'hashed_password_2', 'Trần Thị B', 'student2@school.edu.vn', '0987654321', 'customer'),
    (3, 'student3', 'hashed_password_3', 'Lê Văn C', 'student3@school.edu.vn', '0912345678', 'customer'),
    (4, 'admin1', 'hashed_password_4', 'Phạm Văn D', 'admin1@school.edu.vn', '0934567890', 'admin'),
    (5, 'admin2', 'hashed_password_5', 'Hoàng Thị E', 'admin2@school.edu.vn', '0945678901', 'admin');

-- 2. Vehicles
INSERT INTO Vehicles (user_id, license_plate, vehicle_type) VALUES
    (1, '30 A1 12345', 'sedan'),
    (1, '30 A1 67890', 'suv'),
    (2, '29 B2 54321', 'sedan'),
    (2, '29 B4 98765', 'hatchback'),
    (3, '51 C2 11111', 'suv');

-- 3. Zones
INSERT INTO Zones (zone_id, zone_name, total_slots, available_slots) VALUES
    (1, 'Khu A', 30, 30),
    (2, 'Khu B', 20, 20),
    (3, 'Khu C', 25, 25);

-- 4. Zone_Layouts
INSERT INTO Zone_Layouts (zone_id, layout_type, grid_rows, grid_cols, layout_data) VALUES
    (1, 'grid', 5, 6, NULL),
    (2, 'grid', 4, 5, NULL),
    (3, 'grid', 5, 5, NULL);

-- 5. Slots (khớp với dữ liệu hiện tại của bạn)
-- Khu A: slot_id 1-30
INSERT INTO Slots (slot_id, zone_id, slot_code, status, position_x, position_y) VALUES
    (1, 1, 'A01', 'available', 1, 1), (2, 1, 'A02', 'available', 2, 1), (3, 1, 'A03', 'available', 3, 1),
    (4, 1, 'A04', 'available', 4, 1), (5, 1, 'A05', 'available', 5, 1), (6, 1, 'A06', 'available', 6, 1),
    (7, 1, 'A07', 'available', 1, 2), (8, 1, 'A08', 'available', 2, 2), (9, 1, 'A09', 'available', 3, 2),
    (10, 1, 'A10', 'available', 4, 2), (11, 1, 'A11', 'available', 5, 2), (12, 1, 'A12', 'available', 6, 2),
    (13, 1, 'A13', 'available', 1, 3), (14, 1, 'A14', 'available', 2, 3), (15, 1, 'A15', 'available', 3, 3),
    (16, 1, 'A16', 'available', 4, 3), (17, 1, 'A17', 'available', 5, 3), (18, 1, 'A18', 'available', 6, 3),
    (19, 1, 'A19', 'available', 1, 4), (20, 1, 'A20', 'available', 2, 4), (21, 1, 'A21', 'available', 3, 4),
    (22, 1, 'A22', 'available', 4, 4), (23, 1, 'A23', 'available', 5, 4), (24, 1, 'A24', 'available', 6, 4),
    (25, 1, 'A25', 'available', 1, 5), (26, 1, 'A26', 'available', 2, 5), (27, 1, 'A27', 'available', 3, 5),
    (28, 1, 'A28', 'available', 4, 5), (29, 1, 'A29', 'available', 5, 5), (30, 1, 'A30', 'available', 6, 5);

-- Khu B: slot_id 32-51
INSERT INTO Slots (slot_id, zone_id, slot_code, status, position_x, position_y) VALUES
    (32, 2, 'B01', 'available', 1, 1), (33, 2, 'B02', 'available', 2, 1), (34, 2, 'B03', 'available', 3, 1),
    (35, 2, 'B04', 'available', 4, 1), (36, 2, 'B05', 'available', 5, 1),
    (37, 2, 'B06', 'available', 1, 2), (38, 2, 'B07', 'available', 2, 2), (39, 2, 'B08', 'available', 3, 2),
    (40, 2, 'B09', 'available', 4, 2), (41, 2, 'B10', 'available', 5, 2),
    (42, 2, 'B11', 'available', 1, 3), (43, 2, 'B12', 'available', 2, 3), (44, 2, 'B13', 'available', 3, 3),
    (45, 2, 'B14', 'available', 4, 3), (46, 2, 'B15', 'available', 5, 3),
    (47, 2, 'B16', 'available', 1, 4), (48, 2, 'B17', 'available', 2, 4), (49, 2, 'B18', 'available', 3, 4),
    (50, 2, 'B19', 'available', 4, 4), (51, 2, 'B20', 'available', 5, 4);

-- Khu C: slot_id 63-87
INSERT INTO Slots (slot_id, zone_id, slot_code, status, position_x, position_y) VALUES
    (63, 3, 'C01', 'available', 1, 1), (64, 3, 'C02', 'available', 2, 1), (65, 3, 'C03', 'available', 3, 1),
    (66, 3, 'C04', 'available', 4, 1), (67, 3, 'C05', 'available', 5, 1),
    (68, 3, 'C06', 'available', 1, 2), (69, 3, 'C07', 'available', 2, 2), (70, 3, 'C08', 'available', 3, 2),
    (71, 3, 'C09', 'available', 4, 2), (72, 3, 'C10', 'available', 5, 2),
    (73, 3, 'C11', 'available', 1, 3), (74, 3, 'C12', 'available', 2, 3), (75, 3, 'C13', 'available', 3, 3),
    (76, 3, 'C14', 'available', 4, 3), (77, 3, 'C15', 'available', 5, 3),
    (78, 3, 'C16', 'available', 1, 4), (79, 3, 'C17', 'available', 2, 4), (80, 3, 'C18', 'available', 3, 4),
    (81, 3, 'C19', 'available', 4, 4), (82, 3, 'C20', 'available', 5, 4),
    (83, 3, 'C21', 'available', 1, 5), (84, 3, 'C22', 'available', 2, 5), (85, 3, 'C23', 'available', 3, 5),
    (86, 3, 'C24', 'available', 4, 5), (87, 3, 'C25', 'available', 5, 5);

-- 6. Ticket_Prices
INSERT INTO Ticket_Prices (price_id, ticket_type, price, valid_from, valid_to) VALUES
    (1, 'daily', 10000, '2025-01-01', NULL),
    (2, 'monthly', 200000, '2025-01-01', NULL),
    (3, 'daily', 12000, '2025-01-01', NULL),
    (4, 'monthly', 250000, '2025-01-01', NULL),
    (5, 'daily', 8000, '2025-04-01', '2025-04-30');

-- 7. Bookings (sử dụng slot_id đúng: 2, 32, 64, 3, 65)
INSERT INTO Bookings (user_id, vehicle_id, slot_id, ticket_price_id, booking_type, start_time, end_time, status, qr_code) VALUES
    (1, 1, 2, 1, 'daily', '2025-04-16 08:00:00', '2025-04-16 17:00:00', 'pending', 'QR12345'), -- Slot A02
    (2, 3, 32, 2, 'monthly', '2025-04-16 00:00:00', '2025-05-15 23:59:59', 'confirmed', 'QR67890'), -- Slot B01
    (3, 5, 64, 3, 'daily', '2025-04-17 09:00:00', '2025-04-17 15:00:00', 'confirmed', 'QR54321'), -- Slot C02
    (1, 2, 3, 4, 'monthly', '2025-04-18 00:00:00', '2025-05-17 23:59:59', 'pending', 'QR98765'), -- Slot A03
    (2, 4, 65, 5, 'daily', '2025-04-19 10:00:00', '2025-04-19 16:00:00', 'cancelled', 'QR11223'); -- Slot C03

-- 8. Payments
INSERT INTO Payments (booking_id, amount, payment_method, payment_status) VALUES
    (1, 90000, 'mobile', 'pending'),
    (2, 200000, 'card', 'completed'),
    (3, 72000, 'cash', 'completed'),
    (4, 250000, 'mobile', 'pending'),
    (5, 48000, 'card', 'completed');

-- 9. Check_In_Out
INSERT INTO Check_In_Out (booking_id, check_in_time, check_out_time) VALUES
    (1, '2025-04-16 08:05:00', NULL),
    (2, '2025-04-16 09:00:00', NULL),
    (3, '2025-04-17 09:10:00', '2025-04-17 15:05:00'),
    (4, '2025-04-18 08:30:00', NULL),
    (5, '2025-04-19 10:15:00', '2025-04-19 16:10:00');

-- 10. Reports
INSERT INTO Reports (manager_id, start_date, end_date, total_bookings, total_revenue) VALUES
    (4, '2025-04-01', '2025-04-30', 50, 4500000),
    (4, '2025-03-01', '2025-03-31', 45, 4200000),
    (5, '2025-04-01', '2025-04-30', 30, 3000000),
    (5, '2025-03-01', '2025-03-31', 25, 2500000),
    (4, '2025-02-01', '2025-02-28', 40, 4000000);

-- Cập nhật available_slots
UPDATE Zones
SET available_slots = (
    SELECT COUNT(*) 
    FROM Slots 
    WHERE Slots.zone_id = Zones.zone_id AND Slots.status = 'available'
)
WHERE zone_id IN (1, 2, 3);