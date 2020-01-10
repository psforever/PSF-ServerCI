FROM mozilla/sbt

RUN echo 'deb http://apt.postgresql.org/pub/repos/apt/ stretch-pgdg main' >> /etc/apt/sources.list.d/pgdg.list
RUN wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
RUN apt-get update
RUN apt-get install -y postgresql-11 postgresql-client-11

RUN set -eux; \
	apt-get update; \
	apt-get install -y gosu; \
	rm -rf /var/lib/apt/lists/*; \
# verify that the binary works
	gosu nobody true

RUN chmod 777 /var/run/postgresql

# https://github.com/boxboat/fixuid
RUN addgroup --gid 1000 psfci && \
    adduser --uid 1000 --ingroup psfci --home /home/psfci --shell /bin/bash --disabled-password --gecos "" psfci

RUN USER=psfci && \
    GROUP=psfci && \
    curl -SsL https://github.com/boxboat/fixuid/releases/download/v0.4/fixuid-0.4-linux-amd64.tar.gz | tar -C /usr/local/bin -xzf - && \
    chown root:root /usr/local/bin/fixuid && \
    chmod 4755 /usr/local/bin/fixuid && \
    mkdir -p /etc/fixuid && \
    printf "user: $USER\ngroup: $GROUP\n" > /etc/fixuid/config.yml

COPY docker-entrypoint.sh /usr/local/bin/
ENV PATH="/usr/lib/postgresql/11/bin/:${PATH}"

ENV CI="true"
ENV CONTINUOUS_INTEGRATION="true"
ENV DEBIAN_FRONTEND="noninteractive"

USER psfci:psfci
ENTRYPOINT ["fixuid", "docker-entrypoint.sh"]
