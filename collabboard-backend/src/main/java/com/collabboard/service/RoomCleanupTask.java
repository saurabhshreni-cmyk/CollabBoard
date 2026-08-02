package com.collabboard.service;

import com.collabboard.model.Room;
import com.collabboard.repository.RoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Logs (does not delete) rooms that have been inactive for more than 7 days.
 * Runs at the top of every hour.
 */
@Component
public class RoomCleanupTask {

    private static final Logger log = LoggerFactory.getLogger(RoomCleanupTask.class);
    private static final int INACTIVE_DAYS = 7;

    private final RoomRepository roomRepository;

    public RoomCleanupTask(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @Scheduled(cron = "0 0 * * * *")
    public void logInactiveRooms() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(INACTIVE_DAYS);
        List<Room> inactive = roomRepository.findByLastActivityAtBefore(cutoff);
        if (inactive.isEmpty()) {
            log.info("Room cleanup: no rooms inactive for more than {} days.", INACTIVE_DAYS);
            return;
        }
        log.info("Room cleanup: {} room(s) inactive for more than {} days:", inactive.size(), INACTIVE_DAYS);
        for (Room room : inactive) {
            log.info("  - room {} (last activity: {})", room.getRoomCode(), room.getLastActivityAt());
        }
    }
}
