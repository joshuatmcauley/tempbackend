const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:8081', 'null'],
  credentials: true
}));
app.use(express.json());

// Database connection
const dbPath = path.join(__dirname, '../database/scenic_inn.db');
const db = new sqlite3.Database(dbPath);

// Email configuration (you'll need to set these)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Scenic Inn Booking Beta API' });
});

// Get all menus
app.get('/api/menus', (req, res) => {
  db.all('SELECT * FROM menus ORDER BY name', (err, menus) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, data: menus });
  });
});

// Get menu items for a specific menu
app.get('/api/menus/:menuId/items', (req, res) => {
  const { menuId } = req.params;
  
  db.all(`
    SELECT mi.*, ms.name as section_name 
    FROM menu_items mi 
    JOIN menu_sections ms ON mi.menu_id = ms.menu_id AND mi.section_key = ms.section_key 
    WHERE mi.menu_id = ? 
    ORDER BY ms.section_key, mi.name
  `, [menuId], (err, items) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, data: items });
  });
});

// Submit group booking
app.post('/api/booking', async (req, res) => {
  try {
    const { bookingData, menuSelections, contactEmail } = req.body;
    
    // Validate 24-hour rule
    const bookingDate = moment(bookingData.date);
    const now = moment();
    const hoursUntilBooking = bookingDate.diff(now, 'hours');
    
    if (hoursUntilBooking < 24) {
      return res.status(400).json({ 
        error: 'Bookings must be made at least 24 hours in advance' 
      });
    }
    
    // Generate PDF
    const pdfBuffer = await generateBookingPDF(bookingData, menuSelections);
    
    // Send email
    await sendBookingEmail(contactEmail, pdfBuffer, bookingData);
    
    res.json({ 
      success: true, 
      message: 'Booking submitted successfully! You will receive a confirmation email shortly.' 
    });
    
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to process booking' });
  }
});

// Generate PDF function
async function generateBookingPDF(bookingData, menuSelections) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Group Booking - The Scenic Inn</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #752f15; padding-bottom: 20px; }
        .booking-details { margin: 20px 0; }
        .menu-selections { margin: 20px 0; }
        .person { border: 1px solid #ddd; margin: 10px 0; padding: 15px; }
        .course { margin: 10px 0; }
        .course-title { font-weight: bold; color: #752f15; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>The Scenic Inn</h1>
        <h2>Group Booking Confirmation</h2>
      </div>
      
      <div class="booking-details">
        <h3>Booking Details</h3>
        <p><strong>Date:</strong> ${bookingData.date}</p>
        <p><strong>Time:</strong> ${bookingData.time}</p>
        <p><strong>Party Size:</strong> ${bookingData.partySize}</p>
        <p><strong>Contact Name:</strong> ${bookingData.contactName}</p>
        <p><strong>Contact Email:</strong> ${bookingData.contactEmail}</p>
        <p><strong>Special Requests:</strong> ${bookingData.specialRequests || 'None'}</p>
      </div>
      
      <div class="menu-selections">
        <h3>Menu Selections</h3>
        ${menuSelections.map((person, index) => `
          <div class="person">
            <h4>Person ${index + 1}: ${person.name}</h4>
            ${person.selections.map(selection => `
              <div class="course">
                <div class="course-title">${selection.course}:</div>
                <div>${selection.item} - £${selection.price}</div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </body>
    </html>
  `;
  
  await page.setContent(html);
  const pdf = await page.pdf({ format: 'A4' });
  await browser.close();
  
  return pdf;
}

// Send email function
async function sendBookingEmail(contactEmail, pdfBuffer, bookingData) {
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: [contactEmail, 'restaurant@thescenicinn.com'], // Send to customer and restaurant
    subject: `Group Booking Confirmation - The Scenic Inn - ${bookingData.date}`,
    html: `
      <h2>Thank you for your group booking at The Scenic Inn!</h2>
      <p>Your booking for ${bookingData.partySize} people on ${bookingData.date} at ${bookingData.time} has been confirmed.</p>
      <p>Please find your detailed booking confirmation attached.</p>
      <p>We look forward to welcoming you!</p>
      <p>Best regards,<br>The Scenic Inn Team</p>
    `,
    attachments: [{
      filename: `booking-confirmation-${bookingData.date}.pdf`,
      content: pdfBuffer
    }]
  };
  
  await transporter.sendMail(mailOptions);
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Scenic Inn Booking Beta API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
