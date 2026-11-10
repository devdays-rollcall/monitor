plugins {
    java
    id("io.quarkus") version "3.40.1.1"
    id("com.diffplug.spotless") version "8.10.2"
    id("org.openapi.generator") version "7.27.0"
}

group = "ru.itmo.grouptracking"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation(enforcedPlatform("io.quarkus.platform:quarkus-bom:3.40.1.1"))
    implementation("io.quarkus:quarkus-rest-jackson")
    implementation("io.quarkus:quarkus-jdbc-postgresql")
    implementation("io.quarkus:quarkus-agroal")
    implementation("io.quarkus:quarkus-hibernate-validator")
    implementation("io.quarkus:quarkus-logging-json")
    implementation("io.nats:jnats:2.26.4")
    testImplementation("io.quarkus:quarkus-junit5")
    testImplementation("io.rest-assured:rest-assured")
}

java {
    toolchain.languageVersion = JavaLanguageVersion.of(25)
}

openApiGenerate {
    generatorName.set("jaxrs-spec")
    inputSpec.set(rootProject.file("../openapi.yaml").absolutePath)
    outputDir.set(layout.buildDirectory.dir("generated/openapi").get().asFile.absolutePath)
    modelPackage.set("ru.itmo.grouptracking.api.model")
    globalProperties.set(mapOf("models" to "", "modelDocs" to "false", "modelTests" to "false"))
    configOptions.set(
        mapOf(
            "library" to "quarkus",
            "useJakartaEe" to "true",
            "sourceFolder" to "src/main/java",
            "useSwaggerAnnotations" to "false",
            "useBeanValidation" to "false",
            "openApiNullable" to "false",
            "dateLibrary" to "java8",
            "hideGenerationTimestamp" to "true"
        )
    )
}

sourceSets.main {
    java.srcDir(layout.buildDirectory.dir("generated/openapi/src/main/java"))
}

tasks.compileJava {
    dependsOn(tasks.openApiGenerate)
}

spotless {
    java {
        target("src/**/*.java")
        googleJavaFormat().aosp()
    }
}

tasks.test {
    useJUnitPlatform()
}
