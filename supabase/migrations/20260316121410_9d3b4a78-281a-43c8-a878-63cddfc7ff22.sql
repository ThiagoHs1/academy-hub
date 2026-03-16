
-- 1. Unique phone constraint on students
ALTER TABLE public.students ADD CONSTRAINT students_phone_unique UNIQUE (phone);

-- 2. Trigger: prevent duplicate phone on insert/update
CREATE OR REPLACE FUNCTION public.validate_student_phone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.students WHERE phone = NEW.phone AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
    RAISE EXCEPTION 'Já existe um aluno com este telefone';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_student_phone
BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.validate_student_phone();

-- 3. Trigger: rate limit checkin (max 1 per student per day)
CREATE OR REPLACE FUNCTION public.validate_checkin_rate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.checkins
    WHERE student_id = NEW.student_id
      AND checked_in_at::date = COALESCE(NEW.checked_in_at, now())::date
  ) THEN
    RAISE EXCEPTION 'Aluno já fez check-in hoje';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_checkin_rate
BEFORE INSERT ON public.checkins
FOR EACH ROW EXECUTE FUNCTION public.validate_checkin_rate();

-- 4. Trigger: block checkin for inactive students
CREATE OR REPLACE FUNCTION public.validate_checkin_active_student()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  student_status text;
BEGIN
  SELECT status INTO student_status FROM public.students WHERE id = NEW.student_id;
  IF student_status IS NULL THEN
    RAISE EXCEPTION 'Aluno não encontrado';
  END IF;
  IF student_status != 'active' AND student_status != 'trial' THEN
    RAISE EXCEPTION 'Aluno inativo não pode fazer check-in';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_checkin_active
BEFORE INSERT ON public.checkins
FOR EACH ROW EXECUTE FUNCTION public.validate_checkin_active_student();

-- 5. Trigger: validate payment due_date not in past on insert
CREATE OR REPLACE FUNCTION public.validate_payment_due_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.due_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Data de vencimento não pode ser no passado';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_payment_due_date
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.validate_payment_due_date();
