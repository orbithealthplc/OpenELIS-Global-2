package org.openelisglobal.biorepository.demo;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/**
 * Registers {@link BiorepositoryRetrievalDemoSeed} when {@code org.openelisglobal.biorepository.seedRetrievalDemo}
 * is {@code true} (Spring Framework condition; OpenELIS is not Spring Boot).
 */
public class OnRetrievalDemoSeedPropertyCondition implements Condition {

    public static final String PROPERTY = "org.openelisglobal.biorepository.seedRetrievalDemo";

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return "true".equalsIgnoreCase(context.getEnvironment().getProperty(PROPERTY, "false"));
    }
}
