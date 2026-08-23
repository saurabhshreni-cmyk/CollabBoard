import axios from 'axios';
import { API_BASE_URL } from '../config.js';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function createRoom() {
  try {
    const response = await api.post('/api/rooms');
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      'Failed to create a room. Please try again.';
    throw new Error(message);
  }
}

export async function getRoom(roomCode) {
  try {
    const response = await api.get(`/api/rooms/${roomCode}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Room not found');
    }
    const message =
      error.response?.data?.message ||
      'Failed to load the room. Please try again.';
    throw new Error(message);
  }
}

export async function updateBoardName(roomCode, boardName) {
  try {
    const response = await api.put(`/api/rooms/${roomCode}/name`, { boardName });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message || 'Failed to update board name.';
    throw new Error(message);
  }
}

export async function getHealth() {
  const response = await api.get('/api/health');
  return response.data;
}

/** LAN addresses the backend is reachable on — used by the share dialog. */
export async function getNetworkAddresses() {
  try {
    const response = await api.get('/api/network');
    return response.data?.addresses || [];
  } catch {
    return [];
  }
}

export default api;
