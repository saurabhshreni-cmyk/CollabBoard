package com.collabboard.exception;

/**
 * Thrown when a board event is well-formed but cannot be applied, e.g. it
 * would push the board past its size limits. The message is safe to show to
 * the user who sent the event.
 */
public class BoardEventRejectedException extends RuntimeException {

    public BoardEventRejectedException(String message) {
        super(message);
    }
}
