create table share_tokens (
    token_hash bytea primary key,
    group_id bigint not null references groups(id)
);
