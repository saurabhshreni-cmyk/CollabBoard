package com.collabboard.config;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Render/Heroku hand out postgresql:// URLs; Spring needs jdbc:postgresql://.
 * Getting this wrong means the deployed app dies on startup, so the parsing is
 * pinned down here.
 */
class DatabaseUrlEnvironmentPostProcessorTest {

    @Test
    void convertsARenderStyleUrlIntoJdbcPropertiesAndCredentials() {
        Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.translate(
                "postgresql://collabboard:s3cret@dpg-abc123.oregon-postgres.render.com:5432/collabboard_db");

        assertThat(props.get("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://dpg-abc123.oregon-postgres.render.com:5432/collabboard_db");
        assertThat(props.get("spring.datasource.username")).isEqualTo("collabboard");
        assertThat(props.get("spring.datasource.password")).isEqualTo("s3cret");
        assertThat(props.get("spring.datasource.driver-class-name")).isEqualTo("org.postgresql.Driver");
    }

    @Test
    void acceptsTheShorterPostgresScheme() {
        Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.translate(
                "postgres://user:pass@host:5432/db");

        assertThat(props.get("spring.datasource.url")).isEqualTo("jdbc:postgresql://host:5432/db");
    }

    @Test
    void preservesQueryParametersSuchAsSslMode() {
        Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.translate(
                "postgresql://user:pass@host:5432/db?sslmode=require");

        assertThat(props.get("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://host:5432/db?sslmode=require");
    }

    @Test
    void defaultsThePortWhenTheUrlOmitsIt() {
        Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.translate(
                "postgresql://user:pass@host/db");

        assertThat(props.get("spring.datasource.url")).isEqualTo("jdbc:postgresql://host/db");
    }

    @Test
    void leavesAnExistingJdbcUrlAlone() {
        assertThat(DatabaseUrlEnvironmentPostProcessor.translate(
                "jdbc:postgresql://localhost:5432/collabboard")).isEmpty();
    }

    @Test
    void leavesTheH2DevUrlAlone() {
        assertThat(DatabaseUrlEnvironmentPostProcessor.translate(
                "jdbc:h2:mem:collabboard")).isEmpty();
    }

    @Test
    void ignoresGarbageRatherThanBlowingUpAtStartup() {
        assertThat(DatabaseUrlEnvironmentPostProcessor.translate("postgresql://")).isEmpty();
        assertThat(DatabaseUrlEnvironmentPostProcessor.translate("not a url")).isEmpty();
    }

    @Test
    void handlesAUrlWithNoCredentials() {
        Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.translate(
                "postgresql://host:5432/db");

        assertThat(props.get("spring.datasource.url")).isEqualTo("jdbc:postgresql://host:5432/db");
        assertThat(props).doesNotContainKey("spring.datasource.username");
    }
}
