-- Fix 1: get_lead_counts_unified - Remove active filter to show ALL purchased leads
CREATE OR REPLACE FUNCTION get_lead_counts_unified(
    p_list_id text,
    p_start_date date,
    p_end_date date,
    p_use_policy_date boolean DEFAULT false,
    p_policy_status text DEFAULT NULL,
    p_transfer_status boolean DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_weekend_only boolean DEFAULT false,
    p_page integer DEFAULT 1,
    p_page_size integer DEFAULT 10,
    p_vertical text DEFAULT NULL
)
RETURNS TABLE(
    total_count bigint,
    weekend_count bigint,
    weekday_count bigint,
    leads_data jsonb,
    pagination jsonb
) AS $$
DECLARE
    v_date_field TEXT;
    v_where_clause TEXT;
    v_where_conditions TEXT[];
    v_offset INTEGER;
    v_query TEXT;
    v_count_query TEXT;
    v_total_count bigint;
    v_weekend_count bigint;
    v_weekday_count bigint;
BEGIN
    IF p_use_policy_date THEN
        v_date_field := 'policy_postback_date';
    ELSE
        v_date_field := 'created_at';
    END IF;
    
    v_where_conditions := ARRAY[]::TEXT[];
    
    IF p_list_id IS NOT NULL AND p_list_id != '' THEN
        v_where_conditions := array_append(v_where_conditions, format('l.list_id = %L', p_list_id));
    END IF;
    
    v_where_conditions := array_append(v_where_conditions, format('l.%I >= %L::timestamptz', v_date_field, p_start_date || 'T00:00:00Z'));
    v_where_conditions := array_append(v_where_conditions, format('l.%I <= %L::timestamptz', v_date_field, p_end_date || 'T23:59:59Z'));
    
    IF p_vertical IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, format('lr.vertical = %L', p_vertical));
    END IF;
    
    IF p_policy_status IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, format('l.policy_status = %L', p_policy_status));
    END IF;
    
    IF p_transfer_status IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, format('l.transfer_status = %L', p_transfer_status));
    END IF;
    
    IF p_status IS NULL THEN
        v_where_conditions := array_append(v_where_conditions, 'l.status IN (''new'', ''success'')');
    ELSE
        v_where_conditions := array_append(v_where_conditions, format('l.status = %L', p_status));
    END IF;
    
    IF p_search IS NOT NULL AND p_search != '' THEN
        v_where_conditions := array_append(v_where_conditions, format('(l.phone LIKE %L OR l.email LIKE %L OR l.first_name LIKE %L OR l.last_name LIKE %L)', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%'));
    END IF;
    
    IF p_weekend_only THEN
        v_where_conditions := array_append(v_where_conditions, 'EXTRACT(DOW FROM l.created_at) IN (0, 6)');
    END IF;
    
    v_where_clause := array_to_string(v_where_conditions, ' AND ');
    
    v_count_query := format('
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE EXTRACT(DOW FROM l.created_at) IN (0, 6)) as weekend,
            COUNT(*) FILTER (WHERE EXTRACT(DOW FROM l.created_at) NOT IN (0, 6)) as weekday
        FROM leads l
        LEFT JOIN list_routings lr ON l.list_id = lr.list_id
        WHERE %s
    ', v_where_clause);
    
    EXECUTE v_count_query INTO v_total_count, v_weekend_count, v_weekday_count;
    
    v_offset := (p_page - 1) * p_page_size;
    
    v_query := format('
        SELECT jsonb_agg(row_to_json(l.*)) as leads_data
        FROM (
            SELECT l.*
            FROM leads l
            LEFT JOIN list_routings lr ON l.list_id = lr.list_id
            WHERE %s
            ORDER BY l.%I DESC
            LIMIT %s OFFSET %s
        ) l
    ', v_where_clause, v_date_field, p_page_size, v_offset);
    
    RETURN QUERY
    SELECT 
        v_total_count,
        v_weekend_count,
        v_weekday_count,
        COALESCE((SELECT leads_data FROM (EXECUTE v_query) AS subq), '[]'::jsonb),
        jsonb_build_object(
            'page', p_page,
            'page_size', p_page_size,
            'total_count', v_total_count,
            'total_pages', CEIL(v_total_count::numeric / p_page_size)
        );
END;
$$ LANGUAGE plpgsql;

