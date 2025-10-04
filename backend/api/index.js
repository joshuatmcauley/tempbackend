const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Email configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Hardcoded menu data
const menus = [
  {
    id: 'sunday-lunch',
    name: 'Sunday Lunch Menu',
    schedule: 'Sunday 12pm-5pm',
    pricing: '£25 per person'
  },
  {
    id: 'weekend-evening',
    name: 'Weekend Evening Menu',
    schedule: 'Friday-Sunday 5pm-9pm',
    pricing: '£35 per person'
  },
  {
    id: 'tea-time',
    name: 'Tea Time Menu',
    schedule: 'Daily 2pm-4pm',
    pricing: '£15 per person'
  },
  {
    id: 'lunch',
    name: 'Lunch Menu',
    schedule: 'Monday-Friday 12pm-4:45pm',
    pricing: '£20 per person'
  }
];

const menuItems = {
  'sunday-lunch': [
    { id: '1', name: 'Roast Beef', description: 'Traditional Sunday roast', price: 25, section_key: 'main' },
    { id: '2', name: 'Roast Chicken', description: 'Herb-crusted chicken', price: 22, section_key: 'main' },
    { id: '3', name: 'Vegetable Wellington', description: 'Seasonal vegetables in pastry', price: 20, section_key: 'main' },
    { id: '4', name: 'Sticky Toffee Pudding', description: 'Classic dessert with custard', price: 8, section_key: 'dessert' },
    { id: '5', name: 'Apple Crumble', description: 'Homemade with vanilla ice cream', price: 7, section_key: 'dessert' }
  ],
  'weekend-evening': [
    { id: '6', name: 'Beef Fillet', description: '8oz fillet with red wine jus', price: 35, section_key: 'main' },
    { id: '7', name: 'Salmon', description: 'Pan-seared with lemon butter', price: 28, section_key: 'main' },
    { id: '8', name: 'Chocolate Lava Cake', description: 'Warm chocolate cake with ice cream', price: 9, section_key: 'dessert' }
  ],
  'tea-time': [
    { id: '9', name: 'Afternoon Tea', description: 'Sandwiches, scones, and cakes', price: 15, section_key: 'main' },
    { id: '10', name: 'Cream Tea', description: 'Scones with jam and cream', price: 8, section_key: 'main' }
  ],
  'lunch': [
    { id: '11', name: 'Fish and Chips', description: 'Beer-battered cod with chips', price: 18, section_key: 'main' },
    { id: '12', name: 'Chicken Caesar Salad', description: 'Fresh salad with grilled chicken', price: 16, section_key: 'main' },
    { id: '13', name: 'Beef Burger', description: '8oz burger with fries', price: 17, section_key: 'main' }
  ]
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Scenic Inn Booking Beta API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/menus', (req, res) => {
  res.json({ success: true, data: menus });
});

app.get('/api/menus/:menuId/items', (req, res) => {
  const { menuId } = req.params;
  const items = menuItems[menuId] || [];
  res.json({ success: true, data: items });
});

app.post('/api/booking', async (req, res) => {
  try {
    const { bookingData, menuSelections, contactEmail } = req.body;
    
    // Validate 24-hour rule
    const bookingDate = new Date(bookingData.date);
    const now = new Date();
    const hoursUntilBooking = (bookingDate - now) / (1000 * 60 * 60);
    
    if (hoursUntilBooking < 24) {
      return res.status(400).json({ 
        error: 'Bookings must be made at least 24 hours in advance' 
      });
    }
    
    // Send email
    await sendBookingEmail(contactEmail, bookingData, menuSelections);
    
    res.json({ 
      success: true, 
      message: 'Booking submitted successfully! You will receive a confirmation email shortly.' 
    });
    
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to process booking' });
  }
});

// Send email function
async function sendBookingEmail(contactEmail, bookingData, menuSelections) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: [contactEmail, process.env.RESTAURANT_EMAIL],
    subject: `Group Booking Confirmation - The Scenic Inn - ${bookingData.date}`,
    html: `
      <h2>Thank you for your group booking at The Scenic Inn!</h2>
      <p><strong>Booking Details:</strong></p>
      <ul>
        <li>Date: ${bookingData.date}</li>
        <li>Time: ${bookingData.time}</li>
        <li>Party Size: ${bookingData.partySize}</li>
        <li>Contact Name: ${bookingData.contactName}</li>
        <li>Contact Email: ${bookingData.contactEmail}</li>
        <li>Special Requests: ${bookingData.specialRequests || 'None'}</li>
      </ul>
      
      <h3>Menu Selections:</h3>
      ${menuSelections.map((person, index) => `
        <div style="border: 1px solid #ddd; margin: 10px 0; padding: 15px;">
          <h4>Person ${index + 1}: ${person.name}</h4>
          ${person.selections.map(selection => `
            <p><strong>${selection.course}:</strong> ${selection.item} - £${selection.price}</p>
          `).join('')}
        </div>
      `).join('')}
      
      <p>We look forward to welcoming you!</p>
      <p>Best regards,<br>The Scenic Inn Team</p>
    `
  };
  
  await transporter.sendMail(mailOptions);
}

// Export for Vercel
module.exports = app;
