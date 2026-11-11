alter table groups add column alert_id uuid;

update groups set alert_id = gen_random_uuid() where alert_active;

create table alert_observers (
    group_id bigint not null references groups(id),
    observer_hash bytea not null,
    primary key (group_id, observer_hash)
);

create table alert_approvals (
    group_id bigint not null,
    observer_hash bytea not null,
    primary key (group_id, observer_hash),
    foreign key (group_id, observer_hash) references alert_observers(group_id, observer_hash)
);
