import axios from "axios";

export type AddressOptions = {
    street: string;
    city: string;
    state?: string;
    country: string;
    postal_code: string;
};

export type GeocodeResult = {
    lat: number;
    lng: number;
    formatted_address: string;
    city: string;
    suburb?: string;
    postcode?: string;
    country: string;
};

export async function geocodeAddress(fullAddress: AddressOptions): Promise<GeocodeResult> {
    try {
        const addressParts = [
            fullAddress.street,
            fullAddress.city,
            fullAddress.postal_code,
            fullAddress.country
        ].filter(Boolean);
        console.log("Geocoding address:", addressParts.join(","));
        const response = await axios.get(
            `https://api.locationiq.com/v1/search.php?key=${process.env.LOCATIONIQ_KEY}&q=${addressParts.join(",")}&format=json`,
            {
                headers: {
                    Accept: "application/json",
                },
            },
        );
        const data = response.data[0];

        if (!data) {
            throw new Error("No geocoding results found");
        }

        return {
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lon),
            formatted_address: data.display_name,
            city: data.address?.city || data.address?.town || "",
            suburb: data.address?.suburb,
            postcode: data.address?.postcode,
            country: data.address?.country || "",
        };
    } catch (error) {
        const addressString = [
            fullAddress.street,
            fullAddress.city,
            fullAddress.state,
            fullAddress.postal_code,
            fullAddress.country
        ].filter(Boolean).join(",");
        
        console.error("Geocoding failed:", error);
        throw new Error(
            `Geocoding failed for "${addressString}": ${error}`,
        );
    }
}
