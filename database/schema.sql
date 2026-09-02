CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(80),
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  reset_code_hash TEXT,
  reset_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outlets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  timings TEXT NOT NULL,
  phone VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  duration VARCHAR(100),
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  specialization VARCHAR(255),
  bio TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  trainer_id INTEGER REFERENCES trainers(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_home_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(80),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  student_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'paid',
  payment_method VARCHAR(40) DEFAULT 'card',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_info (
  id SERIAL PRIMARY KEY,
  mission TEXT,
  center_info TEXT
);

CREATE TABLE IF NOT EXISTS weekly_schedules (
  id SERIAL PRIMARY KEY,
  outlet_id INTEGER REFERENCES outlets(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  trainer_id INTEGER REFERENCES trainers(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time VARCHAR(20) NOT NULL,
  end_time VARCHAR(20) NOT NULL,
  mode VARCHAR(20) NOT NULL DEFAULT 'studio'
);

CREATE TABLE IF NOT EXISTS class_enrollments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
  mode VARCHAR(20) NOT NULL,
  whatsapp VARCHAR(40),
  meet_link TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, class_id, mode)
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
  outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  present BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (user_id, class_id, session_date)
);

INSERT INTO outlets (name, address, timings, phone) VALUES
  ('Yoga For Us — Downtown', '12 Lotus Lane, Green Park, New Delhi 110016', 'Mon–Sat 6:00 AM – 9:00 PM · Sun 7:00 AM – 1:00 PM', '+91 98100 11111'),
  ('Yoga For Us  — Riverside', '88 Riverwalk Road, Sector 18, Noida 201301', 'Mon–Fri 6:30 AM – 8:30 PM · Sat–Sun 7:00 AM – 4:00 PM', '+91 98100 22222'),
  ('Yoga For Us — Hillside', '4 Pine Ridge, Mussoorie Road, Dehradun 248001', 'Daily 6:00 AM – 7:00 PM', '+91 98100 33333')
ON CONFLICT DO NOTHING;

INSERT INTO site_info (mission, center_info) VALUES
  (
    'Our mission is to make authentic yoga accessible to every body. We blend classical asana, breathwork, and mindful living so students leave stronger, calmer, and more connected.',
    'Yoga For Us Center has welcomed students since 2014. Our studios use natural light, cork floors, and small class sizes. We offer beginner through teacher-training paths, Ayurvedic workshops, and community seva days each month.'
  )
ON CONFLICT DO NOTHING;

INSERT INTO classes (title, description, price, duration, image_url) VALUES
  ('Hatha Foundations', 'Slow, alignment-focused practice for beginners and anyone rebuilding a steady habit.', 2499, '8 weeks · 60 min', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80'),
  ('Vinyasa Flow', 'Dynamic sequences that link breath and movement. Build heat, strength, and focus.', 3299, '8 weeks · 75 min', 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80'),
  ('Yin & Restore', 'Long-held floor poses and gentle props. Perfect after long desk days.', 2199, '6 weeks · 75 min', 'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=80'),
  ('Prenatal Yoga', 'Safe strength and breath practices for pregnancy, with modifications throughout.', 2799, '10 weeks · 60 min', 'https://images.unsplash.com/photo-1518611012118-696072aa5798?auto=format&fit=crop&w=1200&q=80'),
  ('Power Yoga', 'Athletic flows for experienced students who want intensity without losing form.', 3599, '8 weeks · 75 min', 'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?auto=format&fit=crop&w=1200&q=80'),
  ('Meditation & Pranayama', 'Guided sit, mantra, and breath techniques to settle the nervous system.', 1899, '6 weeks · 45 min', 'https://images.unsplash.com/photo-1599447421416-3414500d18a5?auto=format&fit=crop&w=1200&q=80');

INSERT INTO trainers (name, specialization, bio, image_url) VALUES
  ('Ananya Mehta', 'Hatha & Alignment', 'RYT-500 teacher with 12 years of studio and retreat experience. Ananya focuses on safe alignment and everyday mobility.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80'),
  ('Rohan Iyer', 'Vinyasa & Power', 'Former athlete who found yoga after injury. Rohan builds intelligent heat and helps students find strength without strain.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80'),
  ('Priya Kapoor', 'Yin, Restore & Prenatal', 'Doula and yoga therapist. Priya holds space for rest, pregnancy, and nervous-system care.', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80'),
  ('Kabir Sen', 'Meditation & Pranayama', 'Student of Vedic chanting. Kabir teaches breath as a daily tool, not a weekend luxury.', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80');

INSERT INTO reviews (trainer_id, client_name, rating, comment, is_home_featured) VALUES
  (1, 'Neha Sharma', 5, 'Ananya noticed my shoulder habit in week one. My desk pain is finally easing.', TRUE),
  (1, 'Amit Rao', 5, 'Clear cues, never rushed. Best foundations class I have taken.', FALSE),
  (2, 'Sara Khan', 5, 'Rohan’s power class is tough but I never feel unsafe. I look forward to Thursdays.', TRUE),
  (2, 'Vikram Patel', 4, 'Great sequencing. I got stronger without the usual lower-back flare.', FALSE),
  (3, 'Meera Joshi', 5, 'Prenatal sessions helped me sleep and feel prepared. Grateful for Priya.', TRUE),
  (3, 'Leela Nair', 5, 'Yin class is the reset I need after travel weeks.', FALSE),
  (4, 'Arjun Desai', 5, 'Ten minutes of Kabir’s breath work changed my mornings.', TRUE),
  (4, 'Fatima Ali', 5, 'Meditation finally clicked. Gentle, practical, no fluff.', FALSE);

INSERT INTO payments (student_name, email, class_id, amount, status, payment_method, created_at) VALUES
  ('Neha Sharma', 'neha@example.com', 1, 2499, 'paid', 'upi', NOW() - INTERVAL '12 days'),
  ('Sara Khan', 'sara@example.com', 2, 3299, 'paid', 'card', NOW() - INTERVAL '9 days'),
  ('Meera Joshi', 'meera@example.com', 4, 2799, 'paid', 'upi', NOW() - INTERVAL '6 days'),
  ('Arjun Desai', 'arjun@example.com', 6, 1899, 'paid', 'card', NOW() - INTERVAL '4 days'),
  ('Vikram Patel', 'vikram@example.com', 5, 3599, 'pending', 'netbanking', NOW() - INTERVAL '2 days'),
  ('Leela Nair', 'leela@example.com', 3, 2199, 'paid', 'upi', NOW() - INTERVAL '1 day'),
  ('Amit Rao', 'amit@example.com', 1, 2499, 'failed', 'card', NOW() - INTERVAL '8 hours');
