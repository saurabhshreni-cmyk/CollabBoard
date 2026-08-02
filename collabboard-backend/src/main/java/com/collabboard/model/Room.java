package com.collabboard.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "rooms")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 10)
    private String roomCode;

    @Column(length = 100)
    private String boardName;

    @Column(columnDefinition = "TEXT")
    private String boardSnapshot;

    @Column
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime lastUpdatedAt;

    @Column
    private LocalDateTime lastActivityAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.lastUpdatedAt = now;
        this.lastActivityAt = now;
        if (this.boardSnapshot == null) {
            this.boardSnapshot = "[]";
        }
        if (this.boardName == null || this.boardName.isBlank()) {
            this.boardName = "Untitled Board";
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.lastUpdatedAt = LocalDateTime.now();
    }
}
