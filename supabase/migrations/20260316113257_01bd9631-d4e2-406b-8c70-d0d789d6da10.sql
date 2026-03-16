
-- Plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_days int NOT NULL,
  price decimal NOT NULL,
  features jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Students table
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text UNIQUE NOT NULL,
  email text,
  birth_date date,
  gender text CHECK (gender IN ('M','F','other')),
  photo_url text,
  plan_id uuid REFERENCES public.plans(id),
  enrollment_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','frozen','trial')),
  emergency_contact text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id),
  amount decimal NOT NULL,
  due_date date NOT NULL,
  paid_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  payment_method text CHECK (payment_method IN ('cash','pix','credit','debit','transfer')),
  reference_month text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Checkins table
CREATE TABLE public.checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  checked_in_at timestamptz DEFAULT now(),
  method text DEFAULT 'link' CHECK (method IN ('link','qr','manual'))
);

-- Workout templates table
CREATE TABLE public.workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text CHECK (category IN ('A','B','C','D','E','custom')),
  target_muscles text[],
  created_by uuid,
  is_global boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Workout exercises table
CREATE TABLE public.workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  sets int,
  reps text,
  rest_seconds int,
  notes text,
  sort_order int,
  video_url text
);

-- Student workouts table
CREATE TABLE public.student_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  assigned_date date DEFAULT CURRENT_DATE,
  weekdays text[],
  active boolean DEFAULT true,
  notes text
);

-- Assessments table
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  assessment_date date DEFAULT CURRENT_DATE,
  weight_kg decimal,
  height_cm decimal,
  body_fat_pct decimal,
  muscle_mass_kg decimal,
  chest_cm decimal,
  waist_cm decimal,
  hip_cm decimal,
  right_arm_cm decimal,
  left_arm_cm decimal,
  right_thigh_cm decimal,
  left_thigh_cm decimal,
  right_calf_cm decimal,
  left_calf_cm decimal,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Business settings table
CREATE TABLE public.business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  open_time time,
  close_time time,
  max_capacity int DEFAULT 50,
  checkin_enabled boolean DEFAULT true
);

-- Enable RLS on all tables
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Plans: select public, write authenticated
CREATE POLICY "Plans are viewable by everyone" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert plans" ON public.plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update plans" ON public.plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete plans" ON public.plans FOR DELETE TO authenticated USING (true);

-- Students: select public (for student area by phone), write authenticated
CREATE POLICY "Students viewable by everyone" ON public.students FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert students" ON public.students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update students" ON public.students FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete students" ON public.students FOR DELETE TO authenticated USING (true);

-- Checkins: insert public, select public (for student history)
CREATE POLICY "Anyone can check in" ON public.checkins FOR INSERT WITH CHECK (true);
CREATE POLICY "Checkins viewable by everyone" ON public.checkins FOR SELECT USING (true);

-- Payments: all authenticated
CREATE POLICY "Authenticated users can view payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update payments" ON public.payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete payments" ON public.payments FOR DELETE TO authenticated USING (true);

-- Workout templates: select public, write authenticated
CREATE POLICY "Workout templates viewable by everyone" ON public.workout_templates FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert templates" ON public.workout_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update templates" ON public.workout_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete templates" ON public.workout_templates FOR DELETE TO authenticated USING (true);

-- Workout exercises: select public, write authenticated
CREATE POLICY "Workout exercises viewable by everyone" ON public.workout_exercises FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert exercises" ON public.workout_exercises FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update exercises" ON public.workout_exercises FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete exercises" ON public.workout_exercises FOR DELETE TO authenticated USING (true);

-- Student workouts: select public, write authenticated
CREATE POLICY "Student workouts viewable by everyone" ON public.student_workouts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert student workouts" ON public.student_workouts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update student workouts" ON public.student_workouts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete student workouts" ON public.student_workouts FOR DELETE TO authenticated USING (true);

-- Assessments: select public, write authenticated
CREATE POLICY "Assessments viewable by everyone" ON public.assessments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert assessments" ON public.assessments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update assessments" ON public.assessments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete assessments" ON public.assessments FOR DELETE TO authenticated USING (true);

-- Business settings: select public, write authenticated
CREATE POLICY "Business settings viewable by everyone" ON public.business_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update settings" ON public.business_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert settings" ON public.business_settings FOR INSERT TO authenticated WITH CHECK (true);
