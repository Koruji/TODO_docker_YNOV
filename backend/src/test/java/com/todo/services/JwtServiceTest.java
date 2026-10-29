package com.todo.services;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.todo.models.Users;

class JwtServiceTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef";

    private SecretKey key;
    private JwtDecoder decoder;
    private Users user;

    @BeforeEach
    void setUp() {
        key = new SecretKeySpec(SECRET.getBytes(), "HmacSHA256");
        decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        user = new Users("jade", "jade@ynov.com", "hashed");
        ReflectionTestUtils.setField(user, "id", 42L);
    }

    private JwtService service(long expirationMinutes) {
        return new JwtService(new NimbusJwtEncoder(new ImmutableSecret<>(key)), expirationMinutes);
    }

    @Test
    void tokenSubjectIsUserId() {
        String token = service(60).generateToken(user);

        Jwt jwt = decoder.decode(token);

        assertThat(jwt.getSubject()).isEqualTo("42");
    }

    @Test
    void tokenExpiresAfterConfiguredDuration() {
        String token = service(30).generateToken(user);

        Jwt jwt = decoder.decode(token);

        Duration lifetime = Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt());
        assertThat(lifetime).isEqualTo(Duration.ofMinutes(30));
        assertThat(jwt.getIssuedAt()).isBeforeOrEqualTo(Instant.now());
    }

    @Test
    void tokenSignedWithAnotherKeyIsRejected() {
        SecretKey other = new SecretKeySpec("ffffffffffffffffffffffffffffffff".getBytes(), "HmacSHA256");
        JwtService foreign = new JwtService(new NimbusJwtEncoder(new ImmutableSecret<>(other)), 60);

        String token = foreign.generateToken(user);

        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(RuntimeException.class);
    }
}
