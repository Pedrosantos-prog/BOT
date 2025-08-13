const QUERY_BD = {
  query_URL: `
SELECT 
cpev1.value AS 'ID evento',
cpev2.value AS 'Evento',
DATE(cped.value) as 'date',
SUBSTRING_INDEX(ur.request_path,'/',-1) AS 'URL',
ur.entity_type as 'Tipo do Produto'
FROM url_rewrite as ur
LEFT JOIN catalog_url_rewrite_product_category AS curpc ON ur.url_rewrite_id = curpc.url_rewrite_id
LEFT JOIN catalog_product_entity as cpe ON curpc.product_id = cpe.entity_id 
LEFT JOIN catalog_product_entity_varchar as cpev1 ON cpe.entity_id = cpev1.entity_id 
LEFT JOIN catalog_product_entity_varchar as cpev2 ON cpev2.entity_id = cpev1.value
LEFT JOIN catalog_product_entity_datetime as cped ON cpe.entity_id = cped.entity_id
WHERE entity_type = "product"  
AND cped.value >= '2025-01-01'
AND cpev1.attribute_id = 321
AND cpev2.attribute_id = 73
AND cped.attribute_id = 195
GROUP BY cpev1.value;
`
};

export default QUERY_BD;
