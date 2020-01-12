#!/bin/bash
set -e

if [ "$1" = 'postgres' ]; then
    if [ -z "$(ls -A "$PGDATA")" ]; then
	echo "Creating database..."
        initdb -U psfci
    fi

    echo "Starting postgres..."
    exec postgres -D "$PGDATA"
elif [ "$1" = "setup" ]; then
	until pg_isready; do echo 'Waiting for DB...'; sleep 1; done

	exec psql -v ON_ERROR_STOP=1 postgres <<-EOSQL
	    CREATE USER psforever;
	    ALTER DEFAULT PRIVILEGES FOR ROLE psforever IN SCHEMA PUBLIC GRANT ALL ON TABLES TO psforever;
	    ALTER DEFAULT PRIVILEGES FOR ROLE psforever IN SCHEMA PUBLIC GRANT ALL ON SEQUENCES TO psforever;
	    ALTER USER psforever WITH PASSWORD 'psforever';
	    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA PUBLIC TO psforever;
	    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA PUBLIC TO psforever;

	    CREATE DATABASE psforever OWNER psforever;
	    GRANT ALL PRIVILEGES ON DATABASE psforever TO psforever;
	EOSQL
else
	exec "$@"
fi
