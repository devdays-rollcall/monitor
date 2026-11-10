package ru.itmo.grouptracking;

import io.quarkus.runtime.Quarkus;
import io.quarkus.runtime.annotations.QuarkusMain;
import java.security.Security;

@QuarkusMain
public class Main {
    public static void main(String[] args) {
        Security.setProperty("networkaddress.cache.ttl", "5");
        Security.setProperty("networkaddress.cache.negative.ttl", "1");
        Quarkus.run(args);
    }
}
