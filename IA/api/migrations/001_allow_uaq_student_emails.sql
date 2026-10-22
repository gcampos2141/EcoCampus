BEGIN;

DO $$
DECLARE
    existing_check RECORD;
BEGIN
    FOR existing_check IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.usuarios'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%correo%'
          AND pg_get_constraintdef(oid) ILIKE '%edu%'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.usuarios DROP CONSTRAINT %I',
            existing_check.conname
        );
    END LOOP;
END $$;

ALTER TABLE public.usuarios
    DROP CONSTRAINT IF EXISTS chk_correo_institucional;

ALTER TABLE public.usuarios
    ADD CONSTRAINT chk_correo_institucional
    CHECK (correo ~* '^[a-z0-9._%+-]+@alumnos\.uaq\.mx$');

COMMIT;
