package com.collabboard.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Lets board links work when this server also serves the frontend.
 * <p>
 * The frontend is a single-page app: {@code /room/ABC123} is a route inside
 * it, not a file. Opening or refreshing such a link must return the app's
 * {@code index.html}, which then shows the right board.
 */
@Controller
public class SpaController {

    @GetMapping("/room/{roomCode}")
    public String room() {
        return "forward:/index.html";
    }
}
