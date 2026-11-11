alter table groups
    add column notification_topic uuid not null default gen_random_uuid(),
    add column alert_active boolean not null default false;

create unique index groups_notification_topic_idx on groups (notification_topic);
