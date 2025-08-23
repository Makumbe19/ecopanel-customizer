// src/api/mockApi.js
import { supabase } from "./supabaseClient";

export async function fetchBuilds() {
    const { data, error } = await supabase.from("builds").select("*");
    if (error) {
        console.error("Error fetching builds:", error.message);
        return [];
    }
    return data.map(b => ({
        id: b.id,
        name: b.name,
        sizeSqm: b.size_sqm,
        bedrooms: b.bedrooms,
        bathrooms: b.bathrooms,
        basePrice: b.base_price,
    }));
}

export async function fetchBuildRooms(buildId) {
    const { data: rooms, error } = await supabase
        .from("rooms")
        .select(`
      id, domain, type, base_image,
      properties:properties (
        id, code, name,
        attributes:attributes (
          id, code, name,
          values:attribute_values (
            id, code, label, overlay_url, layer, price
          )
        )
      )
    `)
        .eq("build_id", buildId);

    if (error) {
        console.error("Error fetching rooms:", error.message);
        return [];
    }

    return rooms.map(r => ({
        id: r.id,
        domain: r.domain,
        type: r.type,
        baseImage: r.base_image,
        properties: r.properties.map(p => ({
            id: p.code,
            name: p.name,
            attributes: p.attributes.map(a => ({
                id: a.code,
                name: a.name,
                values: a.values.map(v => ({
                    id: v.code,
                    label: v.label,
                    overlayUrl: v.overlay_url,
                    layer: v.layer,
                    price: v.price,
                }))
            }))
        }))
    }));
}
