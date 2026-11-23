package com.collabboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class CollabboardApplication {

    public static void main(String[] args) {
        useUtc();
        SpringApplication.run(CollabboardApplication.class, args);
    }

    /**
     * Runs the whole application in UTC, whatever the host machine's zone.
     * <p>
     * The PostgreSQL driver sends the JVM's time zone to the server when it
     * connects. On a laptop set to India that is the legacy name
     * "Asia/Calcutta", which newer PostgreSQL builds reject, so the app failed
     * to start. UTC also keeps stored timestamps consistent between a laptop
     * and the hosted server.
     */
    static void useUtc() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }
}
