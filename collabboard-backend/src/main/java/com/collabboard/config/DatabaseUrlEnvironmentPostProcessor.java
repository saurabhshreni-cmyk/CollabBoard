package com.collabboard.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Map;

/**
 * Translates a platform-style database URL into the JDBC properties Spring
 * expects.
 * <p>
 * Render, Heroku, Railway and Fly all expose the database as a single
 * {@code postgresql://user:password@host:port/database} string. Spring Boot
 * only understands {@code jdbc:postgresql://host:port/database} with the
 * credentials supplied separately, and fails at startup on the former. This
 * runs before the DataSource is built and bridges the two, so the same jar
 * boots unchanged locally and on any of those platforms.
 * <p>
 * Anything already in JDBC form is left untouched.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    private static final String PROPERTY_SOURCE_NAME = "collabboardDatabaseUrl";

    /** Checked in order; the first non-blank value wins. */
    private static final String[] CANDIDATE_KEYS = {"DATABASE_URL", "DB_URL", "spring.datasource.url"};

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        for (String key : CANDIDATE_KEYS) {
            String value = environment.getProperty(key);
            if (value == null || value.isBlank()) {
                continue;
            }
            Map<String, Object> translated = translate(value.trim());
            if (!translated.isEmpty()) {
                environment.getPropertySources()
                        .addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, translated));
                return;
            }
        }
    }

    /**
     * @return the JDBC properties derived from {@code url}, or an empty map if
     *         it is already a JDBC URL or cannot be understood.
     */
    static Map<String, Object> translate(String url) {
        if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
            return Map.of();
        }

        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException e) {
            return Map.of();
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            return Map.of();
        }

        StringBuilder jdbc = new StringBuilder("jdbc:postgresql://").append(host);
        if (uri.getPort() != -1) {
            jdbc.append(':').append(uri.getPort());
        }

        String path = uri.getPath();
        jdbc.append(path == null || path.isBlank() ? "/" : path);

        if (uri.getQuery() != null && !uri.getQuery().isBlank()) {
            jdbc.append('?').append(uri.getQuery());
        }

        Map<String, Object> properties = new HashMap<>();
        properties.put("spring.datasource.url", jdbc.toString());
        properties.put("spring.datasource.driver-class-name", "org.postgresql.Driver");

        String userInfo = uri.getUserInfo();
        if (userInfo != null && !userInfo.isBlank()) {
            int separator = userInfo.indexOf(':');
            if (separator >= 0) {
                properties.put("spring.datasource.username", userInfo.substring(0, separator));
                properties.put("spring.datasource.password", userInfo.substring(separator + 1));
            } else {
                properties.put("spring.datasource.username", userInfo);
            }
        }

        return properties;
    }

    @Override
    public int getOrder() {
        // After config files are loaded, so application.properties is visible,
        // but before the DataSource auto-configuration runs.
        return Ordered.LOWEST_PRECEDENCE;
    }
}
