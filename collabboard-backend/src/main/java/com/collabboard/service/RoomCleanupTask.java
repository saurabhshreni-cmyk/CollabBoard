package com.collabboard.service;

import com.collabboard.repository.RoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Hourly housekeeping for abandoned boards.
 * <p>
 * Deletion is opt-in: with {@code ROOM_RETENTION_DAYS} unset (or 0) idle rooms
 * are only counted in the log. Set it to a positive number of days to have
 * rooms with no activity for that long removed, which keeps a small free-tier
 * database from filling up.
 */
@Component
public class RoomCleanupTask {

    private static final Logger log = LoggerFactory.getLogger(RoomCleanupTask.class);
    private static final int REPORT_AFTER_DAYS = 7;

    private final RoomRepository roomRepository;
    private final int retentionDays;

    public RoomCleanupTask(RoomRepository roomRepository,
                           @Value("${app.rooms.retention-days:0}") int retentionDays) {
        this.roomRepository = roomRepository;
        this.retentionDays = retentionDays;
    }

    @Scheduled(cron = "0 0 * * * *")
    public void cleanUp() {
        if (retentionDays > 0) {
            int deleted = roomRepository.deleteByLastActivityAtBefore(
                    LocalDateTime.now().minusDays(retentionDays));
            if (deleted > 0) {
                log.info("Room cleanup: deleted {} room(s) idle for more than {} days.", deleted, retentionDays);
            }
            return;
        }
        long idle = roomRepository.countByLastActivityAtBefore(
                LocalDateTime.now().minusDays(REPORT_AFTER_DAYS));
        if (idle > 0) {
            log.info("Room cleanup: {} room(s) idle for more than {} days "
                    + "(set ROOM_RETENTION_DAYS to delete them automatically).", idle, REPORT_AFTER_DAYS);
        }
    }
}
