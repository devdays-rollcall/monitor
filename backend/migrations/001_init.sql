create table groups (
    id bigint generated always as identity primary key,
    token_hash bytea not null unique,
    created_at timestamptz not null,
    last_contact_at timestamptz not null
);

create table members (
    group_id bigint not null references groups(id),
    member_id uuid not null,
    first_seen_at timestamptz not null,
    last_direct_contact_at timestamptz,
    primary key (group_id, member_id)
);

create table events (
    sequence bigint generated always as identity primary key,
    group_id bigint not null,
    id uuid not null,
    member_id uuid not null,
    type text not null,
    recorded_at timestamptz not null,
    received_at timestamptz not null,
    data jsonb not null,
    unique (group_id, id),
    foreign key (group_id, member_id) references members(group_id, member_id)
);

create index events_group_sequence_idx on events (group_id, sequence);
create index events_group_member_idx on events (group_id, member_id, sequence);
