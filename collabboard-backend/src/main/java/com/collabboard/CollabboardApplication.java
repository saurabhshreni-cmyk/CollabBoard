package com.collabboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CollabboardApplication {

    public static void main(String[] args) {
        SpringApplication.run(CollabboardApplication.class, args);
    }

}
