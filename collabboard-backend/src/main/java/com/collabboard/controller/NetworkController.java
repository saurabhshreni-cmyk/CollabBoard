package com.collabboard.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reports the LAN addresses this server is reachable on, so the share dialog
 * can offer a link that works from other devices — a browser cannot discover
 * the host machine's IP by itself.
 * <p>
 * Deliberately limited to the {@code dev} profile. On a public deployment the
 * shareable link is just the page's own URL, so this endpoint would serve no
 * purpose while handing out a map of the host's private network.
 */
@RestController
@RequestMapping("/api")
@Profile("dev")
public class NetworkController {

    private static final Logger log = LoggerFactory.getLogger(NetworkController.class);

    @GetMapping("/network")
    public Map<String, Object> network() {
        List<String> addresses = new ArrayList<>();
        try {
            for (NetworkInterface iface : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!iface.isUp() || iface.isLoopback() || iface.isVirtual()) {
                    continue;
                }
                for (InetAddress addr : Collections.list(iface.getInetAddresses())) {
                    if (addr instanceof Inet4Address && addr.isSiteLocalAddress()) {
                        addresses.add(addr.getHostAddress());
                    }
                }
            }
        } catch (SocketException e) {
            log.warn("Could not enumerate network interfaces: {}", e.getMessage());
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("addresses", addresses);
        return body;
    }
}
