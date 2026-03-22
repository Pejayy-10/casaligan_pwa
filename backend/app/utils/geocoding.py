"""Geocoding utilities for converting addresses to coordinates"""
import requests
from typing import Optional, Tuple
import time

def geocode_address(
    city: str,
    province: str,
    barangay: Optional[str] = None,
    street_address: Optional[str] = None,
    country: str = "Philippines"
) -> Optional[Tuple[float, float]]:
    """
    Geocode an address to get latitude and longitude using Nominatim (OpenStreetMap)
    
    Returns: (latitude, longitude) tuple or None if geocoding fails
    """
    try:
        # Build address string
        address_parts = []
        if street_address:
            address_parts.append(street_address)
        if barangay:
            address_parts.append(barangay)
        if city:
            address_parts.append(city)
        if province:
            address_parts.append(province)
        address_parts.append(country)
        
        query = ", ".join(address_parts)
        
        # Use Nominatim API (free, no API key required)
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": query,
            "format": "json",
            "limit": 1,
            "countrycodes": "ph"  # Limit to Philippines
        }
        
        headers = {
            "User-Agent": "CasaliganPWA/1.0"  # Required by Nominatim
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=5)
        
        # Respect rate limiting (1 request per second)
        time.sleep(1)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                return (lat, lon)
        
        return None
    except Exception as e:
        print(f"Geocoding error: {e}")
        return None


def calculate_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    """
    Calculate the distance between two coordinates using the Haversine formula
    Returns distance in kilometers
    """
    from math import radians, sin, cos, sqrt, atan2
    
    # Earth's radius in kilometers
    R = 6371.0
    
    # Convert latitude and longitude from degrees to radians
    lat1_rad = radians(lat1)
    lon1_rad = radians(lon1)
    lat2_rad = radians(lat2)
    lon2_rad = radians(lon2)
    
    # Calculate differences
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Haversine formula
    a = sin(dlat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    
    # Distance in kilometers
    distance = R * c
    
    return distance

