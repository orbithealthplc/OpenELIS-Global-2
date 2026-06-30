package org.openelisglobal.biorepository.daoimpl;

import org.openelisglobal.biorepository.dao.BiorepositoryQcRoundPlanDAO;
import org.openelisglobal.biorepository.valueholder.BiorepositoryQcRoundPlan;
import org.openelisglobal.common.daoimpl.BaseDAOImpl;
import org.springframework.stereotype.Component;

@Component
public class BiorepositoryQcRoundPlanDAOImpl extends BaseDAOImpl<BiorepositoryQcRoundPlan, String>
        implements BiorepositoryQcRoundPlanDAO {

    public BiorepositoryQcRoundPlanDAOImpl() {
        super(BiorepositoryQcRoundPlan.class);
    }
}
