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
	    CREATE DATABASE psforever;
	    GRANT ALL PRIVILEGES ON DATABASE psforever TO psforever;
	    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO psforever;
	    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO psforever;
	    ALTER USER psforever WITH PASSWORD 'psforever';
	EOSQL
else
	exec "$@"
fi
