package com.collabboard.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class RoomCreationRateLimitFilterTest {

    @Test
    void allowsRequestsUpToTheLimitThenAnswers429() throws Exception {
        RoomCreationRateLimitFilter filter = new RoomCreationRateLimitFilter(2, Clock.systemUTC());

        assertThat(post(filter, "1.1.1.1").getStatus()).isEqualTo(200);
        assertThat(post(filter, "1.1.1.1").getStatus()).isEqualTo(200);

        MockHttpServletResponse limited = post(filter, "1.1.1.1");
        assertThat(limited.getStatus()).isEqualTo(429);
        assertThat(limited.getHeader("Retry-After")).isEqualTo("60");
        assertThat(limited.getContentAsString()).contains("\"detail\"");
    }

    @Test
    void eachClientAddressHasItsOwnBudget() throws Exception {
        RoomCreationRateLimitFilter filter = new RoomCreationRateLimitFilter(1, Clock.systemUTC());

        assertThat(post(filter, "1.1.1.1").getStatus()).isEqualTo(200);
        assertThat(post(filter, "2.2.2.2").getStatus()).isEqualTo(200);
        assertThat(post(filter, "1.1.1.1").getStatus()).isEqualTo(429);
    }

    @Test
    void budgetResetsWhenTheWindowRollsOver() {
        MutableClock clock = new MutableClock();
        RoomCreationRateLimitFilter filter = new RoomCreationRateLimitFilter(1, clock);

        assertThat(filter.tryAcquire("1.1.1.1")).isTrue();
        assertThat(filter.tryAcquire("1.1.1.1")).isFalse();

        clock.advanceMillis(60_000);

        assertThat(filter.tryAcquire("1.1.1.1")).isTrue();
    }

    @Test
    void otherRequestsAreNeverLimited() throws Exception {
        RoomCreationRateLimitFilter filter = new RoomCreationRateLimitFilter(1, Clock.systemUTC());

        for (int i = 0; i < 5; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(new MockHttpServletRequest("GET", "/api/rooms/ABC123"), response, new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(200);
        }
    }

    @Test
    void zeroDisablesTheLimit() throws Exception {
        RoomCreationRateLimitFilter filter = new RoomCreationRateLimitFilter(0, Clock.systemUTC());

        for (int i = 0; i < 5; i++) {
            assertThat(post(filter, "1.1.1.1").getStatus()).isEqualTo(200);
        }
    }

    private MockHttpServletResponse post(RoomCreationRateLimitFilter filter, String address) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/rooms");
        request.setRemoteAddr(address);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    private static final class MutableClock extends Clock {
        private long millis = 1_000_000;

        void advanceMillis(long delta) {
            millis += delta;
        }

        @Override
        public long millis() {
            return millis;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(millis);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }
}
