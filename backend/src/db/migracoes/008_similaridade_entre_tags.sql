-- Score semântico de tags (S4-14): cada tag pode ter um vetor (embedding) gerado uma vez a partir do nome,
-- e a similaridade entre pares de tags já fica calculada em `tag_similarity`, para a recomendação só ler.
-- Nada aqui é dado pessoal: o vetor vem do nome da tag. Sem vetor a tag vale só pelo score exato.
ALTER TABLE interest_tag ADD COLUMN IF NOT EXISTS embedding JSONB;
ALTER TABLE interest_tag ADD COLUMN IF NOT EXISTS embedding_model TEXT;

CREATE TABLE IF NOT EXISTS tag_similarity (
  tag_a INTEGER NOT NULL REFERENCES interest_tag(id) ON DELETE CASCADE,
  tag_b INTEGER NOT NULL REFERENCES interest_tag(id) ON DELETE CASCADE,
  similarity REAL NOT NULL CHECK (similarity >= 0 AND similarity <= 1),
  PRIMARY KEY (tag_a, tag_b),
  CHECK (tag_a < tag_b)
);
CREATE INDEX IF NOT EXISTS tag_similarity_tag_b ON tag_similarity (tag_b);
