alter table groups add column alert_source text;

update groups set alert_source = 'unknown' where alert_active;
