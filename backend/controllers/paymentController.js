const db = require('../config/database');
const Payment = require('../models/Payment');
const crypto = require('crypto');
const querystring = require('qs');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const Booking = require('../models/Booking');

// Set up logging function
function logVNPay(message, data) {
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  
  const logFile = path.join(logDir, `vnpay-${moment().format('YYYY-MM-DD')}.log`);
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  let logMessage = `\n[${timestamp}] ${message}\n`;
  
  if (data) {
    if (typeof data === 'object') {
      logMessage += JSON.stringify(data, null, 2) + '\n';
    } else {
      logMessage += data + '\n';
    }
  }
  
  fs.appendFileSync(logFile, logMessage);
  console.log(logMessage);
}

function logFullDetails(title, details) {
  try {
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
    
    const detailsLogFile = path.join(logDir, `vnpay-details-${moment().format('YYYY-MM-DD')}.log`);
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    let logMessage = `\n=== ${timestamp} - ${title} ===\n`;
    
    // Log chi tiết từng tham số và giá trị
    if (details) {
      if (typeof details === 'object') {
        for (const key in details) {
          if (details.hasOwnProperty(key)) {
            logMessage += `${key}: ${JSON.stringify(details[key])}\n`;
          }
        }
        logMessage += `Raw JSON: ${JSON.stringify(details, null, 2)}\n`;
      } else {
        logMessage += details + '\n';
      }
    }
    
    fs.appendFileSync(detailsLogFile, logMessage);
    console.log(`Logged detailed information to ${detailsLogFile}`);
  } catch (error) {
    console.error('Error logging details:', error);
  }
}

// VNPAY Config
const vnp_TmnCode = "BXG8SRK8"; // Terminal ID
const vnp_HashSecret = "CCO21KBSH3AZNGQAQO7YT9K1V0X88NEV"; // Sử dụng khóa bí mật chính xác từ VNPay
const vnp_Url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const vnp_ReturnUrl = "https://ef6c-113-22-46-72.ngrok-free.app/api/payment/vnpay-return"; // Using ngrok URL
const vnp_IpnUrl = "https://ef6c-113-22-46-72.ngrok-free.app/payment/vnpay-ipn"; // Using ngrok URL

logVNPay("VNPay Configuration:", {
  vnp_TmnCode,
  vnp_HashSecret,
  vnp_Url,
  vnp_ReturnUrl,
  vnp_IpnUrl
});

// Primary sort function - strictly follows VNPAY specifications
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();
  
  for (const key of keys) {
    if (obj.hasOwnProperty(key) && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      sorted[key] = obj[key];
    }
  }
  
  return sorted;
}

// VNPay sorting function - exact implementation from VNPay documentation
function sortAndEncodeVnpayParams(params) {
  const sortedParams = {};
  const keys = Object.keys(params).sort();
  
  for (const key of keys) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      // Đảm bảo tất cả các giá trị đều là chuỗi
      sortedParams[key] = String(params[key]);
    }
  }
  
  return sortedParams;
}

// VNPay official hash calculation method (from VNPay documentation)
function getVNPaySignature(params, secretKey) {
  try {
    // Tạo bản sao sâu của các tham số để tránh sửa đổi bản gốc
    const paramsCopy = JSON.parse(JSON.stringify(params));
    
    // Đảm bảo tất cả các giá trị đều là chuỗi
    Object.keys(paramsCopy).forEach(key => {
      if (paramsCopy[key] !== undefined && paramsCopy[key] !== null) {
        paramsCopy[key] = String(paramsCopy[key]);
      }
    });
    
    // Loại bỏ các trường rỗng
    Object.keys(paramsCopy).forEach(key => {
      if (paramsCopy[key] === '') {
        delete paramsCopy[key];
      }
    });
    
    // Ghi nhật ký tham số gốc để gỡ lỗi
    logFullDetails("Chi tiết tạo chữ ký VNPay", {
      rawParams: paramsCopy
    });
    
    // Bước 1: Sắp xếp tham số theo thứ tự từ điển (ASCII)
    const sortedParams = sortObject(paramsCopy);
    
    // Xử lý đặc biệt cho OrderInfo - Thay thế khoảng trắng bằng dấu +
    if (sortedParams['vnp_OrderInfo']) {
      sortedParams['vnp_OrderInfo'] = encodeURIComponent(sortedParams['vnp_OrderInfo']).replace(/%20/g, '+');
    }
    
    // Xử lý đặc biệt cho ReturnUrl - Mã hóa URL
    if (sortedParams['vnp_ReturnUrl']) {
      sortedParams['vnp_ReturnUrl'] = encodeURIComponent(sortedParams['vnp_ReturnUrl']);
    }
    
    // Ghi nhật ký tham số đã sắp xếp để gỡ lỗi
    logFullDetails("Chi tiết tạo chữ ký VNPay", {
      sortedParams: sortedParams
    });
    
    // Bước 2: Tạo chuỗi query chỉ với các trường có giá trị
    let queryString = '';
    const fieldNames = Object.keys(sortedParams).sort();
    
    fieldNames.forEach((fieldName, index) => {
      if (index > 0) {
        queryString += '&';
      }
      queryString += `${fieldName}=${sortedParams[fieldName]}`;
    });
    
    // Ghi nhật ký chuỗi query để gỡ lỗi
    logFullDetails("Chi tiết tạo chữ ký VNPay", {
      signData: queryString,
      secretKey: secretKey,
    });
    
    // Bước 3: Tạo chữ ký với HMAC-SHA512
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(queryString, 'utf-8')).digest('hex');
    
    // Ghi nhật ký chữ ký và chi tiết để gỡ lỗi
    logFullDetails("Chi tiết tạo chữ ký VNPay", {
      signatureHex: signed,
      hmacAlgorithm: "sha512"
    });
    
    return {
      queryString,
      signature: signed
    };
  } catch (error) {
    logVNPay("Lỗi tạo chữ ký VNPay:", error.stack || error.message);
    throw error; // Ném lại lỗi để xử lý trong caller
  }
}

class PaymentController {
  async createVnpayPayment(req, res) {
    try {
      logVNPay("=== YÊU CẦU TẠO THANH TOÁN VNPAY ===", req.body);
      
      const { bookingId, orderInfo = "Thanh toan dat cho", returnUrl, amount: requestAmount } = req.body;
      
      if (!bookingId) {
        logVNPay("Thiếu các tham số bắt buộc", { bookingId });
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin thanh toán bắt buộc'
        });
      }
      
      // Kiểm tra đặt chỗ có tồn tại
      const [bookings] = await db.query('SELECT * FROM Bookings WHERE booking_id = ?', [bookingId]);
      logVNPay("Kết quả kiểm tra đặt chỗ:", { found: bookings.length > 0, bookingId });
      
      if (!bookings.length) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin đặt chỗ'
        });
      }
      const booking = bookings[0];
      // Lấy số tiền thanh toán - ưu tiên số tiền từ request
      let amount = 0;
      if (requestAmount) {
        amount = parseFloat(requestAmount);
      } else {
        // Nếu không có số tiền từ request, lấy từ booking
        if (booking.booking_type === 'monthly') {
          amount = parseFloat(booking.amount || booking.price || 0);
        } else if (booking.booking_type === 'daily') {
          amount = parseFloat(booking.amount || booking.price || 0);
        } else {
          amount = parseFloat(booking.amount || booking.price || 0);
        }
      }

      logVNPay("Số tiền thanh toán:", { 
        requestAmount, 
        bookingAmount: booking.amount,
        bookingPrice: booking.price,
        finalAmount: amount 
      });

      // Kiểm tra và validate số tiền
      if (!amount || amount < 5000 || amount >= 1000000000) {
        logVNPay("Số tiền không hợp lệ", { amount });
        return res.status(400).json({
          success: false,
          message: 'Số tiền thanh toán không hợp lệ (phải từ 5,000đ đến dưới 1 tỷ đồng)'
        });
      }
      // Tạo bản ghi thanh toán trong cơ sở dữ liệu
      const paymentId = await Payment.create(bookingId, amount, 'vnpay');
      logVNPay("Đã tạo bản ghi thanh toán:", { paymentId, bookingId, amount });
      
      // Xác định loại returnUrl và thiết lập giá trị phù hợp cho web/mobile
      let appReturnUrl = '';
      let isMobileApp = false;
      
      // Kiểm tra nếu có URL trả về từ ứng dụng di động
      if (returnUrl && (returnUrl.startsWith('parkingapp://') || 
          (returnUrl.includes('://') && !returnUrl.startsWith('http')))) {
        logVNPay("Phát hiện URL trả về từ ứng dụng di động:", returnUrl);
        appReturnUrl = returnUrl;
        isMobileApp = true;
      }
      
      // Các URL để sử dụng cho VNPay phải luôn là HTTP(S) URL
      const webReturnUrl = "https://ef6c-113-22-46-72.ngrok-free.app/api/payment/vnpay-return";
      
      // Đảm bảo sử dụng đúng URL trả về cho VNPay
      logVNPay("URL trả về được sử dụng cho VNPay:", webReturnUrl);
      
      // Tạo URL thanh toán VNPAY
      const createDate = moment().format('YYYYMMDDHHmmss');
      const orderId = moment().format('YYYYMMDDHHmmss') + bookingId;  // Bỏ tiền tố DH để giữ định dạng đơn giản hơn
      
      // Chuẩn hóa địa chỉ IP thành định dạng IPv4
      let ipAddr = req.ip || req.connection.remoteAddress || '127.0.0.1';
      // Chuyển đổi IPv6 thành IPv4 nếu cần
      if (ipAddr.includes('::ffff:')) {
        ipAddr = ipAddr.replace('::ffff:', '');
      }
      
      // Tạo tham số VNPay chính xác theo tài liệu
      let vnp_Params = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: vnp_TmnCode,
        vnp_Locale: 'vn',
        vnp_CurrCode: 'VND',
        vnp_TxnRef: orderId,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: 'billpayment',
        vnp_Amount: amount * 100, // Chuyển đổi sang xu (1 VND = 100 xu)
        vnp_ReturnUrl: webReturnUrl, // Luôn sử dụng web URL cho VNPay
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate,
        vnp_BankCode: 'NCB'
      };
      
      // Ghi nhật ký tham số gốc trước khi mã hóa
      logVNPay("Tham số gốc VNPay:", vnp_Params);
      
      // Tạo chữ ký chính xác theo tài liệu VNPay
      const vnpayResult = getVNPaySignature(vnp_Params, vnp_HashSecret);
      
      logVNPay("Chuỗi dữ liệu signData VNPay:", vnpayResult.queryString);
      logVNPay("Chữ ký VNPay đã tạo:", vnpayResult.signature);
      
      // Tạo URL thanh toán đầy đủ
      const paymentUrl = `${vnp_Url}?${vnpayResult.queryString}&vnp_SecureHash=${vnpayResult.signature}`;
      
      logVNPay("URL thanh toán VNPay:", paymentUrl);
      
      // Lưu mã tham chiếu orderId và returnUrl để sử dụng sau
      await db.query('UPDATE Payments SET reference_id = ?, meta_data = ? WHERE payment_id = ?', 
        [orderId, JSON.stringify({ returnUrl: appReturnUrl || '' }), paymentId]);
        
      logVNPay("Cập nhật bản ghi thanh toán với reference_id:", {
        paymentId,
        orderId,
        returnUrl: appReturnUrl || ''
      });
      
      res.status(200).json({
        success: true,
        data: {
          paymentUrl: paymentUrl
        }
      });
      
      logVNPay("=== TẠO THANH TOÁN VNPAY THÀNH CÔNG ===", { paymentUrl });
    } catch (error) {
      logVNPay("Lỗi khi tạo thanh toán VNPAY:", error.stack || error.message || error);
      console.error('Lỗi khi tạo thanh toán VNPAY:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi tạo thanh toán'
      });
    }
  }
  
  async vnpayIpn(req, res) {
    try {
      logVNPay("=== NHẬN THÔNG BÁO IPN TỪ VNPAY ===", {
        query: req.query,
        headers: req.headers,
        ip: req.ip
      });
      
      // Lấy các tham số từ VNPay
      let vnp_Params = Object.assign({}, req.query);
      
      // Lấy mã hash bảo mật
      const secureHash = vnp_Params['vnp_SecureHash'];
      
      if (!secureHash) {
        logVNPay("Thiếu tham số SecureHash trong IPN params");
        return res.status(200).json({
          RspCode: '97',
          Message: 'Thiếu chữ ký'
        });
      }
      
      // Ghi nhật ký tham số
      logVNPay("Tham số IPN:", vnp_Params);
      
      // Xóa hash để xác minh
      delete vnp_Params['vnp_SecureHash'];
      delete vnp_Params['vnp_SecureHashType'];
      
      // Tạo chữ ký
      const vnpResult = getVNPaySignature(vnp_Params, vnp_HashSecret);
      
      logVNPay("Xác minh IPN:", {
        receivedHash: secureHash,
        calculatedHash: vnpResult.signature,
        queryString: vnpResult.queryString
      });
      
      // Xác minh chữ ký
      const isValidSignature = (secureHash === vnpResult.signature);
      
      if (!isValidSignature) {
        logVNPay("Xác minh chữ ký IPN thất bại!", {
          received: secureHash,
          expected: vnpResult.signature,
          params: vnp_Params
        });
        
        return res.status(200).json({
          RspCode: '97',
          Message: 'Chữ ký không hợp lệ'
        });
      }
      
      // Xử lý thanh toán
      const vnp_ResponseCode = vnp_Params['vnp_ResponseCode'];
      const vnp_TxnRef = vnp_Params['vnp_TxnRef'];
      const vnp_Amount = parseFloat(vnp_Params['vnp_Amount']);
      
      // Thanh toán thành công
      if (vnp_ResponseCode === '00') {
        try {
          // Tìm thanh toán
          const [payments] = await db.query(
            'SELECT * FROM Payments WHERE reference_id = ? LIMIT 1',
            [vnp_TxnRef]
          );
          
          if (payments.length > 0) {
            const paymentId = payments[0].payment_id;
            
            // Xác minh số tiền
            const storedAmount = parseFloat(payments[0].amount);
            const receivedAmount = vnp_Amount / 100;
            
            if (Math.abs(storedAmount - receivedAmount) > 1) {
              logVNPay("Số tiền không khớp", {
                stored: storedAmount,
                received: receivedAmount
              });
              
              return res.status(200).json({
                RspCode: '04',
                Message: 'Số tiền không khớp'
              });
            }
            
            // Cập nhật trạng thái thanh toán
            await db.query(
              'UPDATE Payments SET payment_status = ?, response_code = ?, transaction_ref = ?, paid_at = NOW() WHERE payment_id = ?',
              ['completed', vnp_ResponseCode, vnp_Params['vnp_TransactionNo'] || '', paymentId]
            );
            
            // Cập nhật trạng thái đặt chỗ
            await db.query(
              'UPDATE Bookings SET status = ? WHERE booking_id = ?',
              ['confirmed', payments[0].booking_id]
            );
            
            logVNPay("Thanh toán hoàn tất thành công", {
              paymentId: paymentId,
              bookingId: payments[0].booking_id
            });
            
            return res.status(200).json({
              RspCode: '00',
              Message: 'Xác nhận thành công'
            });
          } else {
            logVNPay("Không tìm thấy thanh toán", { referenceId: vnp_TxnRef });
            
            return res.status(200).json({
              RspCode: '01',
              Message: 'Không tìm thấy đơn hàng'
            });
          }
        } catch (error) {
          logVNPay("Lỗi cơ sở dữ liệu:", error.message);
          
          return res.status(200).json({
            RspCode: '99',
            Message: 'Lỗi cơ sở dữ liệu'
          });
        }
      } else {
        // Thanh toán thất bại
        try {
          const [payments] = await db.query(
            'SELECT * FROM Payments WHERE reference_id = ? LIMIT 1',
            [vnp_TxnRef]
          );
          
          if (payments.length > 0) {
            await db.query(
              'UPDATE Payments SET payment_status = ?, response_code = ? WHERE payment_id = ?',
              ['failed', vnp_ResponseCode, payments[0].payment_id]
            );
            
            logVNPay("Thanh toán thất bại", {
              paymentId: payments[0].payment_id,
              responseCode: vnp_ResponseCode
            });
          }
        } catch (error) {
          logVNPay("Lỗi cơ sở dữ liệu cho thanh toán thất bại:", error.message);
        }
        
        return res.status(200).json({
          RspCode: '00',
          Message: 'Xác nhận thành công'
        });
      }
    } catch (error) {
      logVNPay("Lỗi callback IPN:", error.message);
      
      return res.status(200).json({
        RspCode: '99',
        Message: 'Lỗi không xác định'
      });
    }
  }
  
  async vnpayReturn(req, res) {
    try {
      logVNPay("=== XỬ LÝ CALLBACK TRẢ VỀ TỪ VNPAY ===", {
        query: req.query,
        ip: req.ip
      });
      
      // URL trả về mặc định (frontend)
      let returnUrl = "https://ef6c-113-22-46-72.ngrok-free.app/payment/result";
      let isMobileApp = false;
      
      // Lấy tất cả tham số từ VNPay
      let vnp_Params = Object.assign({}, req.query);
      
      // Ghi nhật ký tham số gốc
      logVNPay("Tham số trả về:", vnp_Params);
      
      // Lấy mã hash bảo mật từ tham số
      const secureHash = vnp_Params['vnp_SecureHash'];
      
      if (!secureHash) {
        logVNPay("Thiếu tham số SecureHash trong dữ liệu trả về");
        return res.redirect(`${returnUrl}?status=failed&message=${encodeURIComponent('Chữ ký không hợp lệ')}`);
      }
      
      // Xóa hash và loại hash khỏi tham số để xác minh
      delete vnp_Params['vnp_SecureHash'];
      delete vnp_Params['vnp_SecureHashType'];
      
      // Tạo chữ ký bằng phương thức của VNPay
      const vnpResult = getVNPaySignature(vnp_Params, vnp_HashSecret);
      
      logVNPay("Xác minh trả về:", {
        receivedHash: secureHash,
        calculatedHash: vnpResult.signature,
        queryString: vnpResult.queryString
      });
      
      // Kiểm tra tính hợp lệ của chữ ký
      const isSignatureValid = (secureHash === vnpResult.signature);
      const paymentSuccess = (vnp_Params['vnp_ResponseCode'] === '00');
      
      // Chuẩn bị dữ liệu kết quả
      const responseData = {
        vnp_ResponseCode: vnp_Params['vnp_ResponseCode'],
        orderId: vnp_Params['vnp_TxnRef'],
        amount: parseFloat(vnp_Params['vnp_Amount']) / 100, // Chuyển đổi lại từ xu
        message: paymentSuccess ? 'Thanh toán thành công' : 'Thanh toán thất bại'
      };
      
      // Nếu chữ ký không hợp lệ, thanh toán được coi là thất bại
      if (!isSignatureValid) {
        responseData.message = 'Chữ ký không hợp lệ';
        logVNPay("Chữ ký thanh toán không hợp lệ", {
          received: secureHash,
          expected: vnpResult.signature,
          params: vnp_Params
        });
      } 
      // Nếu thanh toán thành công, cập nhật cơ sở dữ liệu
      else if (paymentSuccess) {
        logVNPay("Thanh toán thành công", {
          orderId: vnp_Params['vnp_TxnRef'],
          amount: responseData.amount
        });
        
        try {
          const [payments] = await db.query('SELECT * FROM Payments WHERE reference_id = ?', [vnp_Params['vnp_TxnRef']]);
          
          if (payments.length) {
            // Cập nhật thông tin thanh toán - kiểm tra xem cột có tồn tại không
            try {
              await db.query(
                'UPDATE Payments SET payment_status = ?, response_code = ? WHERE payment_id = ?',
                ['completed', vnp_Params['vnp_ResponseCode'], payments[0].payment_id]
              );

              // Thêm reference nếu có trong transaction
              if (vnp_Params['vnp_TransactionNo']) {
                try {
                  await db.query(
                    'UPDATE Payments SET transaction_ref = ? WHERE payment_id = ?',
                    [vnp_Params['vnp_TransactionNo'], payments[0].payment_id]
                  );
                } catch (err) {
                  logVNPay("Lỗi khi cập nhật transaction_ref (cột có thể không tồn tại):", err.message);
                  // Không cần dừng xử lý thanh toán nếu cột không tồn tại
                }
              }
            
              // Cập nhật trạng thái đặt chỗ thành đã xác nhận
              await db.query(
                'UPDATE Bookings SET status = ? WHERE booking_id = ?',
                ['confirmed', payments[0].booking_id]
              );
            
              logVNPay("Đã cập nhật cơ sở dữ liệu cho thanh toán thành công", {
                paymentId: payments[0].payment_id,
                bookingId: payments[0].booking_id
              });
            } catch (dbUpdateError) {
              logVNPay("Lỗi khi cập nhật dữ liệu thanh toán:", dbUpdateError.message);
            }
          }
        } catch (dbError) {
          logVNPay("Lỗi cơ sở dữ liệu khi cập nhật trạng thái thanh toán:", dbError.stack || dbError.message);
        }
      }
      // Nếu thanh toán thất bại vì lý do khác
      else {
        // Ánh xạ mã phản hồi sang thông báo
        const responseMessages = {
          '01': 'Giao dịch đã tồn tại',
          '02': 'Merchant không hợp lệ',
          '03': 'Dữ liệu gửi sang không đúng định dạng',
          '04': 'Khởi tạo GD không thành công do Website đang bị tạm khóa',
          '05': 'Giao dịch không thành công do: Quý khách nhập sai mật khẩu thanh toán quá số lần quy định',
          '06': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu thanh toán',
          '07': 'Giao dịch bị nghi ngờ là giao dịch gian lận',
          '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ',
          '10': 'Xác thực OTP không thành công',
          '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán',
          '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
          '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch',
          '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày',
          '75': 'Ngân hàng thanh toán đang bảo trì',
          '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán nhiều lần',
          '99': 'Lỗi khác'
        };
        
        responseData.message = responseMessages[vnp_Params['vnp_ResponseCode']] || 'Giao dịch không thành công';
        
        logVNPay("Thanh toán thất bại", {
          orderId: vnp_Params['vnp_TxnRef'],
          responseCode: vnp_Params['vnp_ResponseCode'],
          message: responseData.message
        });
        
        // Cập nhật trạng thái thanh toán thành thất bại
        try {
          const [payments] = await db.query('SELECT * FROM Payments WHERE reference_id = ?', [vnp_Params['vnp_TxnRef']]);
          
          if (payments.length) {
            await db.query(
              'UPDATE Payments SET payment_status = ?, response_code = ? WHERE payment_id = ?',
              ['failed', vnp_Params['vnp_ResponseCode'], payments[0].payment_id]
            );
          }
        } catch (dbError) {
          logVNPay("Lỗi cơ sở dữ liệu khi cập nhật trạng thái thanh toán thất bại:", dbError.stack || dbError.message);
        }
      }
      
      // Lấy returnUrl từ meta_data của thanh toán nếu có thể
      try {
        const orderId = vnp_Params['vnp_TxnRef'];
        
        const [payments] = await db.query(
          'SELECT * FROM Payments WHERE reference_id = ? LIMIT 1',
          [orderId]
        );
        
        if (payments.length > 0 && payments[0].meta_data) {
          const metaData = JSON.parse(payments[0].meta_data);
          if (metaData.returnUrl) {
            returnUrl = metaData.returnUrl;
            // Kiểm tra xem có phải URL ứng dụng di động không
            if (returnUrl.startsWith('parkingapp://') || 
                (returnUrl.includes('://') && !returnUrl.startsWith('http'))) {
              isMobileApp = true;
              logVNPay("Tìm thấy URL trả về cho ứng dụng di động:", returnUrl);
            }
          }
        }
      } catch (err) {
        logVNPay("Lỗi khi lấy meta_data thanh toán:", err);
      }
      
      // Chuẩn bị chuỗi query cho chuyển hướng
      const status = (isSignatureValid && paymentSuccess) ? 'success' : 'failed';
      const redirectParams = `status=${status}&message=${encodeURIComponent(responseData.message)}&amount=${responseData.amount}`;
      let redirectUrl;
      
      // Tạm thời luôn chuyển hướng về trang web kết quả thanh toán
      // để khắc phục vấn đề với Expo và URL scheme trên di động
      const webResultUrl = "https://ef6c-113-22-46-72.ngrok-free.app/api/payment/result";
      redirectUrl = `${webResultUrl}?${redirectParams}`;
      logVNPay("Chuyển hướng đến trang web (áp dụng cho tất cả thiết bị):", redirectUrl);
      
      // Chuyển hướng đến frontend với kết quả
      res.redirect(redirectUrl);
    } catch (error) {
      logVNPay("Lỗi trong xử lý callback:", error.stack || error.message || error);
      
      // Chuyển hướng đến frontend với lỗi
      res.redirect(`https://ef6c-113-22-46-72.ngrok-free.app/api/payment/result?status=failed&message=${encodeURIComponent('Lỗi xử lý thanh toán')}`);
    }
  }
  
  // Hiển thị trang kết quả thanh toán
  async showPaymentResult(req, res) {
    try {
      const { status, message, amount } = req.query;
      
      // Tạo HTML cho trang kết quả thanh toán
      const html = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Kết quả thanh toán</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
              }
              .container {
                  border-radius: 10px;
                  padding: 20px;
                  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                  text-align: center;
                  margin-top: 50px;
              }
              .success {
                  background-color: #d4edda;
                  border: 1px solid #c3e6cb;
              }
              .failed {
                  background-color: #f8d7da;
                  border: 1px solid #f5c6cb;
              }
              h1 {
                  font-size: 24px;
                  margin-bottom: 20px;
              }
              .amount {
                  font-size: 22px;
                  font-weight: bold;
                  margin: 20px 0;
              }
              .message {
                  margin: 15px 0;
              }
              .back-button {
                  display: inline-block;
                  padding: 10px 20px;
                  background-color: #007bff;
                  color: white;
                  text-decoration: none;
                  border-radius: 5px;
                  margin-top: 20px;
              }
          </style>
      </head>
      <body>
          <div class="container ${status === 'success' ? 'success' : 'failed'}">
              <h1>
                  ${status === 'success' ? 'Thanh toán thành công!' : 'Thanh toán thất bại!'}
              </h1>
              ${amount ? `<div class="amount">${parseInt(amount).toLocaleString('vi-VN')} VNĐ</div>` : ''}
              <div class="message">${message || ''}</div>
              <a href="/" class="back-button">Quay lại trang chủ</a>
          </div>
      </body>
      </html>
      `;
      
      // Gửi HTML đến client
      res.send(html);
      
    } catch (error) {
      console.error('Lỗi hiển thị trang kết quả:', error);
      res.status(500).send('Đã xảy ra lỗi khi hiển thị kết quả thanh toán.');
    }
  }
  
  // API kiểm tra trạng thái thanh toán
  async checkPaymentStatus(req, res) {
    try {
      const { bookingId } = req.params;
      
      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu ID đặt chỗ'
        });
      }
      
      // Tìm thông tin đặt chỗ và thanh toán
      const [bookings] = await db.query(`
        SELECT b.*, p.payment_status, p.amount, p.paid_at
        FROM Bookings b
        LEFT JOIN Payments p ON b.booking_id = p.booking_id
        WHERE b.booking_id = ?
        ORDER BY p.payment_id DESC
        LIMIT 1
      `, [bookingId]);
      
      if (!bookings.length) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin đặt chỗ'
        });
      }
      
      const booking = bookings[0];
      
      // Trả về trạng thái thanh toán
      return res.json({
        success: true,
        data: {
          bookingId: booking.booking_id,
          status: booking.status,
          paymentStatus: booking.payment_status || 'pending',
          amount: booking.amount || 0,
          paidAt: booking.paid_at || null,
          isPaymentCompleted: booking.payment_status === 'completed'
        }
      });
      
    } catch (error) {
      console.error('Lỗi kiểm tra trạng thái thanh toán:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi kiểm tra trạng thái thanh toán'
      });
    }
  }
}

module.exports = new PaymentController(); 