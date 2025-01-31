CREATE EXTENSION moddatetime;

-- Function to add trigger only to tables with a time_updated column
CREATE OR REPLACE FUNCTION sync_time_updated()
RETURNS event_trigger AS $$
DECLARE 
    tbl_name TEXT;
    trigger_exists BOOLEAN;
BEGIN
    FOR tbl_name IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'time_updated'
        AND table_schema = 'public'
    LOOP
        -- Check if the trigger already exists for this table
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.triggers
            WHERE event_object_schema = 'public'
            AND event_object_table = tbl_name
            AND trigger_name = 'time_updated_handle'
        ) INTO trigger_exists;

        -- Add trigger only if the table has a time_updated column and the trigger doesn't exist
        IF NOT trigger_exists THEN
            EXECUTE format(
                'CREATE TRIGGER time_updated_handle BEFORE UPDATE ON %I 
                 FOR EACH ROW EXECUTE FUNCTION moddatetime(time_updated)', 
                tbl_name
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE EVENT TRIGGER time_updated_ensure
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION sync_time_updated();

