// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const facilityAuthRoutes = require('./routes/facilityAuth');
const shiftsRoutes = require('./routes/shifts');
const applicationRoutes = require('./routes/applications');

//importing db.js and connecting to database
const db = require('./config/db');

// Initialize Express app
const app = express();

// Configure middleware
app.use(cors({
  origin: 'http://localhost:5173', // Allow our frontend URL
  credentials: true
}));
app.use(express.json()); // This needs to be before routes to parse JSON bodies

// Use routes
app.use('/api/facility-auth', facilityAuthRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/applications', applicationRoutes);


// Simple health check endpoint
app.get('/health', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.status(200).json({
      status: 'ok',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Nurse Connect API is running');
});

// User login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Query to find user by email
    const userQuery = `
      SELECT id, email, first_name, last_name, role, password_hash 
      FROM users 
      WHERE email = $1
    `;
    const userResult = await db.query(userQuery, [email]);
    
    // Check if user exists
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password due to testing this is temp commented out
    
    //const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    //if (!isPasswordValid) {
    //  return res.status(401).json({ error: 'Invalid credentials' });
    //}

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // Remove sensitive information before sending
    const { password_hash, ...userResponse } = user;

    res.json({
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Facility login endpoint
app.post('/api/facility-auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Query to find facility by email
    const facilityQuery = `
      SELECT id, name, contact_email, address, city, state, zip_code, password_hash 
      FROM facilities 
      WHERE contact_email = $1
    `;
    const facilityResult = await db.query(facilityQuery, [email]);
    
    // Check if facility exists
    if (facilityResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const facility = facilityResult.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, facility.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: facility.id, 
        email: facility.contact_email, 
        type: 'facility' 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // Remove sensitive information before sending
    const { password_hash, ...facilityResponse } = facility;

    res.json({
      facility: facilityResponse,
      token
    });
  } catch (error) {
    console.error('Facility login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Facility registration endpoint
app.post('/api/facility-auth/register', async (req, res) => {
  try {
    const { 
      name, 
      address, 
      city, 
      state, 
      zip_code, 
      contact_name, 
      contact_phone, 
      contact_email, 
      password 
    } = req.body;

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert new facility into database
    const insertQuery = `
      INSERT INTO facilities 
      (name, address, city, state, zip_code, contact_name, contact_phone, contact_email, password_hash, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id, name, address, city, state, zip_code, contact_name, contact_phone, contact_email, created_at
    `;
    
    const values = [
      name, 
      address, 
      city, 
      state, 
      zip_code, 
      contact_name, 
      contact_phone, 
      contact_email, 
      passwordHash
    ];

    const result = await db.query(insertQuery, values);
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: result.rows[0].id, 
        email: contact_email, 
        type: 'facility' 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.status(201).json({
      facility: result.rows[0],
      token
    });
  } catch (error) {
    console.error('Facility registration error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get all facilities endpoint
app.get('/api/facilities', async (req, res) => {
  try {
    // Query to get all facilities
    const query = `
      SELECT 
        id, 
        name, 
        address, 
        city, 
        state, 
        zip_code, 
        contact_name, 
        contact_phone, 
        contact_email
      FROM facilities
      ORDER BY name
    `;
    
    const result = await db.query(query);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting facilities:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get facility by ID
app.get('/api/facilities/:id', async (req, res) => {
  try {
    const query = `
      SELECT 
        id, 
        name, 
        address, 
        city, 
        state, 
        zip_code, 
        contact_name, 
        contact_phone, 
        contact_email
      FROM facilities
      WHERE id = $1
    `;
    
    const result = await db.query(query, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Facility not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting facility:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create shift endpoint
app.post('/api/shifts', async (req, res) => {
  try {
    const { 
      facility_id, 
      unit, 
      shift_type, 
      start_time, 
      end_time, 
      hourly_rate, 
      status, 
      requirements 
    } = req.body;

    console.log('Received shift creation request:', req.body);

    // Validate required fields
    if (!facility_id || !unit || !shift_type || !start_time || !end_time || !hourly_rate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Force status to be 'open' for new shifts
    const shiftStatus = 'open';

    // Insert new shift into database
    const insertQuery = `
      INSERT INTO shifts 
      (facility_id, unit, shift_type, start_time, end_time, hourly_rate, status, requirements)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      facility_id, 
      unit, 
      shift_type, 
      start_time, 
      end_time, 
      hourly_rate, 
      shiftStatus, // Always use 'open'
      requirements || []
    ];

    console.log('Executing SQL query with values:', values);
    const result = await db.query(insertQuery, values);
    
    console.log('Shift created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating shift:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Delete shift endpoint
app.delete('/api/shifts/:id', async (req, res) => {
  try {
    const shiftId = req.params.id;
    console.log(`Attempting to delete shift with ID: ${shiftId}`);
    
    // First check if the shift exists
    const checkQuery = 'SELECT * FROM shifts WHERE id = $1';
    const checkResult = await db.query(checkQuery, [shiftId]);
    
    if (checkResult.rows.length === 0) {
      console.log(`Shift with ID ${shiftId} not found`);
      return res.status(404).json({ error: 'Shift not found' });
    }
    
    // Delete the shift
    const deleteQuery = 'DELETE FROM shifts WHERE id = $1 RETURNING id';
    const result = await db.query(deleteQuery, [shiftId]);
    
    console.log(`Successfully deleted shift with ID: ${shiftId}`);
    res.status(200).json({ success: true, message: 'Shift deleted successfully' });
  } catch (error) {
    console.error(`Error deleting shift with ID ${req.params.id}:`, error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});


// Updated GET /api/shifts endpoint
app.get('/api/shifts', async (req, res) => {
  try {
    // Extract filter parameters from query string
    const { facility_id, status, startDate, endDate } = req.query;
    
    // Start building the query
    let query = `
      SELECT 
        s.id, 
        s.facility_id, 
        f.name AS facility_name,
        s.unit, 
        s.shift_type, 
        s.start_time, 
        s.end_time, 
        s.hourly_rate, 
        s.status, 
        s.requirements
      FROM shifts s
      JOIN facilities f ON s.facility_id = f.id
      WHERE 1=1
    `;
    
    // Array to hold query parameters
    const queryParams = [];
    let paramCounter = 1;
    
    // Add facility_id filter if provided
    if (facility_id) {
      query += ` AND s.facility_id = $${paramCounter++}`;
      queryParams.push(facility_id);
    }
    
    // Add status filter if provided
    if (status) {
      query += ` AND s.status = $${paramCounter++}`;
      queryParams.push(status);
    }
    
    // Add date filters if provided
    if (startDate) {
      query += ` AND s.start_time >= $${paramCounter++}`;
      queryParams.push(new Date(startDate));
    }
    
    if (endDate) {
      query += ` AND s.end_time <= $${paramCounter++}`;
      queryParams.push(new Date(endDate));
    }
    
    // Add order by clause
    query += ` ORDER BY s.start_time`;
    
    // Execute the query with parameters
    const result = await db.query(query, queryParams);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting shifts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get shift by ID endpoint
app.get('/api/shifts/:id', async (req, res) => {
  try {
    const shiftId = req.params.id;
    
    const query = `
      SELECT 
        s.id, 
        s.facility_id, 
        f.name AS facility_name,
        s.unit, 
        s.shift_type, 
        s.start_time, 
        s.end_time, 
        s.hourly_rate, 
        s.status, 
        s.requirements
      FROM shifts s
      JOIN facilities f ON s.facility_id = f.id
      WHERE s.id = $1
    `;
    
    const result = await db.query(query, [shiftId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting shift by ID:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Enhanced GET /api/shifts endpoint with improved date handling
app.get('/api/shifts', async (req, res) => {
  try {
    // Extract filter parameters from query string
    const { facility_id, status, startDate, endDate } = req.query;
    
    console.log('-------- GET /api/shifts Request --------');
    console.log('Query parameters:', req.query);
    console.log('Status filter:', status, typeof status);
    console.log('Date filter (startDate):', startDate, typeof startDate);
    
    // First, let's check what status values exist in the database
    const statusCheckQuery = 'SELECT DISTINCT status FROM shifts';
    const statusResult = await db.query(statusCheckQuery);
    console.log('Available status values in the database:', statusResult.rows.map(row => row.status));
    
    // Start building the query
    let query = `
      SELECT 
        s.id, 
        s.facility_id, 
        f.name AS facility_name,
        s.unit, 
        s.shift_type, 
        s.start_time, 
        s.end_time, 
        s.hourly_rate, 
        s.status, 
        s.requirements
      FROM shifts s
      JOIN facilities f ON s.facility_id = f.id
      WHERE 1=1
    `;
    
    // Array to hold query parameters
    const queryParams = [];
    let paramCounter = 1;
    
    // Add facility_id filter if provided
    if (facility_id) {
      query += ` AND s.facility_id = $${paramCounter++}`;
      queryParams.push(facility_id);
      console.log('Added facility_id filter:', facility_id);
    }
    
    // Add status filter if provided - using exact matching
    if (status && status.trim() !== '') {
      query += ` AND s.status = $${paramCounter++}`;
      queryParams.push(status.trim());
      console.log('Added status filter:', status.trim());
    }
    
    // Add date filter if provided - using date comparison with CAST for clarity
    if (startDate && startDate.trim() !== '') {
      // Extract just the date part and format properly for date comparison
      query += ` AND DATE(s.start_time) = $${paramCounter++}::date`;
      queryParams.push(startDate.trim());
      console.log('Added date filter:', startDate.trim());
      
      // Debug logging of actual dates in the database
      const datesQuery = `
        SELECT DISTINCT DATE(start_time) as date 
        FROM shifts 
        ORDER BY date
      `;
      const datesResult = await db.query(datesQuery);
      console.log('Available dates in the database:', 
        datesResult.rows.map(row => row.date.toISOString().split('T')[0])
      );
    }
    
    // Add end date filter if provided
    if (endDate && endDate.trim() !== '') {
      query += ` AND DATE(s.end_time) <= $${paramCounter++}::date`;
      queryParams.push(endDate.trim());
      console.log('Added end date filter:', endDate.trim());
    }
    
    // Add order by clause
    query += ` ORDER BY s.start_time`;
    
    console.log('Final SQL query:', query);
    console.log('Query parameters:', queryParams);
    
    // Execute the query with parameters
    const result = await db.query(query, queryParams);
    console.log('Found', result.rows.length, 'shifts');
    if (result.rows.length > 0) {
      console.log('Sample shift data:', {
        id: result.rows[0].id,
        facility_id: result.rows[0].facility_id, 
        status: result.rows[0].status,
        start_time: result.rows[0].start_time,
        date_part: new Date(result.rows[0].start_time).toISOString().split('T')[0]
      });
    }
    
    // Try direct queries for debugging
    if (status && status.trim() !== '') {
      const directQuery = 'SELECT COUNT(*) FROM shifts WHERE status = $1';
      const directResult = await db.query(directQuery, [status.trim()]);
      console.log(`Direct query for status '${status.trim()}' found:`, directResult.rows[0].count, 'shifts');
    }
    
    if (startDate && startDate.trim() !== '') {
      const directDateQuery = 'SELECT COUNT(*) FROM shifts WHERE DATE(start_time) = $1::date';
      const directDateResult = await db.query(directDateQuery, [startDate.trim()]);
      console.log(`Direct query for date '${startDate.trim()}' found:`, directDateResult.rows[0].count, 'shifts');
    }
    
    console.log('-------- END GET /api/shifts --------');
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting shifts:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});


// ADDING THE EDIT UPDATE ROUTE
app.put('/api/shifts/edit/:id', async (req, res) => {
  try {
    const shiftId = req.params.id;
    const {
      facility_id,
      unit,
      shift_type,
      start_time,
      end_time,
      hourly_rate,
      status,
      requirements
    } = req.body;

    console.log(`Trying to update shift with id ${shiftId}`, req.body);

    //checking if the shift exists
    const checkQuery = `SELECT * FROM shifts WHERE id = $1`;
    const checkResult = await db.query(checkQuery, [shiftId]);

    if (checkResult.rows.length === 0){
      console.log(`Shift with id ${req.params.id} does not exist`);
      return res.status(404).json({error: 'shift not found'});
    }
    
  

    //updating the shift
    const updateQuery = `
      UPDATE shifts
      SET
        facility_id = $1,
        unit = $2,
        shift_type = $3,
        start_time = $4,
        end_time = $5,
        hourly_rate = $6,
        status = $7,
        requirements = $8
      WHERE id = $9
      RETURNING *
    `;

    const values = [
      facility_id,
      unit,
      shift_type,
      start_time,
      end_time,
      hourly_rate,
      status,
      requirements || [],
      shiftId
    ];

    const result = await db.query(updateQuery, values);

    console.log(`Successfully updated the shift id: ${req.params.id}`);
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Error in updating the shift with id ${req.params.id}`, error);
    res.status(500).json({ error: 'Server error', details: error.message});
  }
});


const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Test database connection on startup
  db.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection error:', err.stack);
    } else {
      console.log('Database connected successfully:', res.rows[0].now);
    }
  });
});

module.exports = { app, db };