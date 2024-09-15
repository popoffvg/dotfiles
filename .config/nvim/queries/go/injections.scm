(
     (raw_string_literal) @injection.content
     (#match? @injection.content "SELECT|select|INSERT|insert|FROM|from|CASE|case|WHERE|where|UPDATE|update")
     (#set! injection.language "sql")
 )
