package com.collabboard.repository;

import com.collabboard.model.Room;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {

    Optional<Room> findByRoomCode(String roomCode);

    boolean existsByRoomCode(String roomCode);

    /**
     * Loads a room and holds a row lock until the surrounding transaction
     * ends. Snapshot edits are read-modify-write, so without this two
     * concurrent events on one board would overwrite each other. A database
     * lock (rather than a JVM one) also stays correct with several instances.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Room r where r.roomCode = :roomCode")
    Optional<Room> findByRoomCodeForUpdate(@Param("roomCode") String roomCode);

    long countByLastActivityAtBefore(LocalDateTime cutoff);

    @Modifying
    @Transactional
    @Query("delete from Room r where r.lastActivityAt < :cutoff")
    int deleteByLastActivityAtBefore(@Param("cutoff") LocalDateTime cutoff);
}
