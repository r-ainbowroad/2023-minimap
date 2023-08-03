-- intended to be sourced into psql, after changing the passwords
CREATE USER writer PASSWORD 'lol';
CREATE USER grafana PASSWORD 'no';

CREATE DATABASE ponyplace_analytics;
GRANT ALL ON DATABASE ponyplace_analytics TO writer;
GRANT CONNECT ON DATABASE ponyplace_analytics TO grafana;

\c ponyplace_analytics

CREATE TABLE placements(
        timestamp timestamp,
        template varchar(40),
        json text
);

CREATE INDEX bytime ON placements(timestamp, template);

GRANT SELECT ON placements TO grafana;
GRANT INSERT ON placements TO writer;

CREATE TABLE others(
        timestamp timestamp,
        event varchar(40),
        json text
);

CREATE INDEX others_bytime ON others(timestamp);

GRANT SELECT ON others TO grafana;
GRANT INSERT ON others TO writer;
